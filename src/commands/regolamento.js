import { Markup } from "telegraf";
import { cercaGiochi, elencoFileBGG, linkFilesBGG } from "../services/bgg.js";

// Mostra la lista dei file del gioco come pulsanti (ITA; se vuota, tutte le lingue).
async function mostraFile(ctx, bggId) {
  let bandiera = "🇮🇹";
  let files = await elencoFileBGG(bggId); // default: italiano

  if (files.length === 0) {
    files = await elencoFileBGG(bggId, null); // fallback: tutte le lingue
    bandiera = "🌐";
  }

  if (files.length === 0) {
    return ctx.reply(
      "Nessun file trovato su BGG per questo gioco.",
      Markup.inlineKeyboard([[Markup.button.url("📂 Apri i file su BGG", linkFilesBGG(bggId, "", null))]])
    );
  }

  const bottoni = files.map((f) => {
    const etichetta = `📄 ${f.titolo.slice(0, 48)}${f.voti ? ` (👍${f.voti})` : ""}`;
    return [Markup.button.url(etichetta, f.url)];
  });

  return ctx.reply(`📖 Regolamenti e file ${bandiera}:`, Markup.inlineKeyboard(bottoni));
}

export function registraComandoRegolamento(bot) {
  bot.command("regolamento", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ").trim();

    if (!query) {
      return ctx.reply("Uso: /regolamento nome del gioco\nEs: /regolamento obsession");
    }

    const attesa = await ctx.reply("🔍 Cerco i file...");

    try {
      const risultati = await cercaGiochi(query);

      if (risultati.length === 0) {
        return ctx.telegram.editMessageText(
          ctx.chat.id, attesa.message_id, undefined,
          `Nessun gioco trovato per "${query}".`
        );
      }

      // Un solo risultato: mostra subito i file.
      if (risultati.length === 1) {
        await ctx.telegram.deleteMessage(ctx.chat.id, attesa.message_id).catch(() => {});
        return mostraFile(ctx, risultati[0].bgg_id);
      }

      // Più risultati: scegli il gioco.
      const bottoni = risultati.map((r) =>
        [Markup.button.callback(`${r.nome}${r.anno ? ` (${r.anno})` : ""}`, `file:${r.bgg_id}`)]
      );
      await ctx.telegram.editMessageText(
        ctx.chat.id, attesa.message_id, undefined,
        `Ho trovato ${risultati.length} giochi per "${query}". Di quale vuoi i file?`,
        Markup.inlineKeyboard(bottoni)
      );
    } catch (err) {
      console.error("Errore /regolamento:", err);
      await ctx.telegram.editMessageText(
        ctx.chat.id, attesa.message_id, undefined,
        "⚠️ Errore nel recupero dei file, riprova tra poco."
      ).catch(() => {});
    }
  });

  // Tap su un gioco (da /regolamento o dal bottone della scheda /cerca).
  bot.action(/^file:(\d+)$/, async (ctx) => {
    const bggId = Number(ctx.match[1]);
    try {
      await ctx.answerCbQuery("Carico i file...");
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      await mostraFile(ctx, bggId);
    } catch (err) {
      console.error("Errore callback file:", err);
      await ctx.answerCbQuery("⚠️ Errore, riprova.").catch(() => {});
    }
  });
}
