import { Markup } from "telegraf";
import { cercaGiochi, dettagliGioco, linkFilesBGG } from "../services/bgg.js";
import Gioco from "../models/Gioco.js";

const GIORNI_CACHE = 7;

async function getGiocoConCache(bggId) {
  const esistente = await Gioco.findOne({ bgg_id: bggId });
  const scaduta =
    esistente && Date.now() - esistente.cached_at.getTime() > GIORNI_CACHE * 24 * 60 * 60 * 1000;

  if (esistente && !scaduta) return esistente;

  const dettagli = await dettagliGioco(bggId);
  if (!dettagli) return esistente ?? null;

  return Gioco.findOneAndUpdate(
    { bgg_id: bggId },
    { ...dettagli, cached_at: new Date() },
    { upsert: true, new: true }
  );
}

// Testo scheda gioco (Markdown).
function formattaScheda(gioco) {
  return [
    `🎲 *${gioco.nome}* (${gioco.anno ?? "?"})`,
    gioco.giocatori_min && `👥 ${gioco.giocatori_min}-${gioco.giocatori_max} giocatori`,
    gioco.durata_min && `⏱ ${gioco.durata_min}-${gioco.durata_max ?? gioco.durata_min} min`,
    gioco.eta_minima && `🔞 Età minima: ${gioco.eta_minima}+`,
    gioco.peso && `⚖️ Complessità: ${gioco.peso}/5`,
    `🔗 https://boardgamegeek.com/boardgame/${gioco.bgg_id}`
  ].filter(Boolean).join("\n");
}

// Recupera dettagli e manda la scheda (con foto se disponibile).
async function inviaScheda(ctx, bggId) {
  const gioco = await getGiocoConCache(bggId);
  if (!gioco) {
    return ctx.reply("⚠️ Impossibile recuperare i dettagli del gioco.");
  }

  const testo = formattaScheda(gioco);
  // Bottone URL diretto alla sezione file/regolamenti su BGG.
  const bottoni = Markup.inlineKeyboard([
    [Markup.button.url("📖 Regolamento 🇮🇹", linkFilesBGG(gioco.bgg_id, gioco.nome))]
  ]);

  if (gioco.immagine_url) {
    return ctx.replyWithPhoto(gioco.immagine_url, {
      caption: testo,
      parse_mode: "Markdown",
      ...bottoni
    });
  }
  return ctx.reply(testo, { parse_mode: "Markdown", ...bottoni });
}

export function registraComandoCerca(bot) {
  bot.command("cerca", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ").trim();

    if (!query) {
      return ctx.reply("Uso: /cerca nome del gioco\nEs: /cerca brass birmingham");
    }

    const attesa = await ctx.reply("🔍 Cerco su BGG...");

    try {
      const risultati = await cercaGiochi(query);

      if (risultati.length === 0) {
        return ctx.telegram.editMessageText(
          ctx.chat.id,
          attesa.message_id,
          undefined,
          `Nessun risultato per "${query}".`
        );
      }

      // Un solo risultato: mostra subito la scheda.
      if (risultati.length === 1) {
        await ctx.telegram.deleteMessage(ctx.chat.id, attesa.message_id);
        return inviaScheda(ctx, risultati[0].bgg_id);
      }

      // Più risultati: chiedi all'utente quale, con pulsanti inline.
      const bottoni = risultati.map((r) =>
        [Markup.button.callback(
          `${r.nome}${r.anno ? ` (${r.anno})` : ""}`,
          `cerca:${r.bgg_id}`
        )]
      );

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        attesa.message_id,
        undefined,
        `Ho trovato ${risultati.length} giochi per "${query}". Quale intendi?`,
        Markup.inlineKeyboard(bottoni)
      );
    } catch (err) {
      console.error("Errore /cerca:", err);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        attesa.message_id,
        undefined,
        "⚠️ Errore nella ricerca, riprova tra poco."
      );
    }
  });

  // Tap su un pulsante della lista risultati.
  bot.action(/^cerca:(\d+)$/, async (ctx) => {
    const bggId = Number(ctx.match[1]);
    try {
      await ctx.answerCbQuery("Carico la scheda...");
      // Rimuove i pulsanti dal messaggio di scelta.
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      await inviaScheda(ctx, bggId);
    } catch (err) {
      console.error("Errore callback cerca:", err);
      await ctx.answerCbQuery("⚠️ Errore, riprova.").catch(() => {});
    }
  });
}

export { getGiocoConCache };
