import { Markup } from "telegraf";
import { cercaGiochi, linkFilesBGG } from "../services/bgg.js";

export function registraComandoRegolamento(bot) {
  bot.command("regolamento", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ").trim();

    if (!query) {
      return ctx.reply("Uso: /regolamento nome del gioco\nEs: /regolamento nucleum");
    }

    try {
      const risultati = await cercaGiochi(query);

      if (risultati.length === 0) {
        return ctx.reply(`Nessun gioco trovato per "${query}".`);
      }

      // Un solo risultato: link diretto alla pagina file.
      if (risultati.length === 1) {
        const gioco = risultati[0];
        return ctx.reply(
          `📖 *${gioco.nome}*\nRegolamenti, FAQ e traduzioni:`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.url("📂 File su BGG", linkFilesBGG(gioco.bgg_id))]
            ])
          }
        );
      }

      // Più risultati: un pulsante URL per gioco, apre la pagina file su BGG.
      const bottoni = risultati.map((r) =>
        [Markup.button.url(
          `📖 ${r.nome}${r.anno ? ` (${r.anno})` : ""}`,
          linkFilesBGG(r.bgg_id)
        )]
      );

      await ctx.reply(
        `Ho trovato ${risultati.length} giochi per "${query}". Apri i file del gioco giusto:`,
        Markup.inlineKeyboard(bottoni)
      );
    } catch (err) {
      console.error("Errore /regolamento:", err);
      await ctx.reply("⚠️ Errore nel recupero del link, riprova tra poco.");
    }
  });
}
