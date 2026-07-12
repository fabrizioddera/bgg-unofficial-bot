import { Markup } from "telegraf";
import { cercaGiochi, linkFilesBGG, trovaRegolamento } from "../services/bgg.js";

// Cerca il regolamento del gioco e risponde: link diretto al file se trovato,
// altrimenti link alla pagina file generica su BGG.
async function rispondiRegolamento(ctx, bggId) {
  const reg = await trovaRegolamento(bggId);

  if (reg) {
    const bandiera = reg.italiano ? "🇮🇹" : "🌐";
    return ctx.reply(
      `📖 Regolamento trovato ${bandiera}\n*${reg.titolo}*`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.url("📥 Apri il file", reg.url)]])
      }
    );
  }

  // Nessun file di regole: apri la pagina file completa.
  return ctx.reply(
    "📖 Nessun regolamento riconosciuto tra i file. Guarda tutti i file su BGG:",
    Markup.inlineKeyboard([[Markup.button.url("📂 File su BGG", linkFilesBGG(bggId))]])
  );
}

export function registraComandoRegolamento(bot) {
  bot.command("regolamento", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ").trim();

    if (!query) {
      return ctx.reply("Uso: /regolamento nome del gioco\nEs: /regolamento nucleum");
    }

    const attesa = await ctx.reply("🔍 Cerco il regolamento...");

    try {
      const risultati = await cercaGiochi(query);

      if (risultati.length === 0) {
        return ctx.telegram.editMessageText(
          ctx.chat.id, attesa.message_id, undefined,
          `Nessun gioco trovato per "${query}".`
        );
      }

      // Un solo risultato: cerca subito il regolamento.
      if (risultati.length === 1) {
        await ctx.telegram.deleteMessage(ctx.chat.id, attesa.message_id).catch(() => {});
        return rispondiRegolamento(ctx, risultati[0].bgg_id);
      }

      // Più risultati: fai scegliere quale gioco.
      const bottoni = risultati.map((r) =>
        [Markup.button.callback(`${r.nome}${r.anno ? ` (${r.anno})` : ""}`, `reg:${r.bgg_id}`)]
      );
      await ctx.telegram.editMessageText(
        ctx.chat.id, attesa.message_id, undefined,
        `Ho trovato ${risultati.length} giochi per "${query}". Quale regolamento vuoi?`,
        Markup.inlineKeyboard(bottoni)
      );
    } catch (err) {
      console.error("Errore /regolamento:", err);
      await ctx.telegram.editMessageText(
        ctx.chat.id, attesa.message_id, undefined,
        "⚠️ Errore nel recupero del regolamento, riprova tra poco."
      ).catch(() => {});
    }
  });

  // Tap sul bottone "Regolamento" (dalla scheda /cerca o dalla scelta /regolamento).
  bot.action(/^reg:(\d+)$/, async (ctx) => {
    const bggId = Number(ctx.match[1]);
    try {
      await ctx.answerCbQuery("Cerco il regolamento...");
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      await rispondiRegolamento(ctx, bggId);
    } catch (err) {
      console.error("Errore callback reg:", err);
      await ctx.answerCbQuery("⚠️ Errore, riprova.").catch(() => {});
    }
  });
}
