import { cercaGiochi } from "../services/bgg.js";
import ListaItem from "../models/ListaItem.js";

const STATI_VALIDI = ["posseduto", "da_comprare", "provato"];
const EMOJI_STATO = {
  posseduto: "✅",
  da_comprare: "🛒",
  provato: "🎯"
};

export function registraComandoLista(bot) {
  bot.command("lista", async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    const sottocomando = args[0]?.toLowerCase();

    // /lista (senza argomenti) -> mostra la lista del gruppo
    if (!sottocomando) {
      const items = await ListaItem.find({ chat_id: ctx.chat.id }).sort({ stato: 1, nome: 1 });

      if (items.length === 0) {
        return ctx.reply(
          "Lista vuota. Aggiungi un gioco con:\n/lista add nome_gioco"
        );
      }

      const gruppi = STATI_VALIDI.map((stato) => {
        const delGruppo = items.filter((i) => i.stato === stato);
        if (delGruppo.length === 0) return null;
        const righe = delGruppo.map((i) => `  • ${i.nome}`).join("\n");
        return `${EMOJI_STATO[stato]} *${stato}*\n${righe}`;
      }).filter(Boolean);

      return ctx.reply(gruppi.join("\n\n"), { parse_mode: "Markdown" });
    }

    // /lista add nome_gioco [stato]
    if (sottocomando === "add") {
      const ultimaParola = args[args.length - 1]?.toLowerCase();
      const statoSpecificato = STATI_VALIDI.includes(ultimaParola) ? ultimaParola : null;

      const nomeQuery = statoSpecificato
        ? args.slice(1, -1).join(" ")
        : args.slice(1).join(" ");

      if (!nomeQuery.trim()) {
        return ctx.reply(
          "Uso: /lista add nome_gioco [posseduto|da_comprare|provato]\n" +
          "Es: /lista add great western trail posseduto"
        );
      }

      const risultati = await cercaGiochi(nomeQuery);
      if (risultati.length === 0) {
        return ctx.reply(`Nessun gioco trovato per "${nomeQuery}".`);
      }

      const gioco = risultati[0];

      try {
        await ListaItem.create({
          chat_id: ctx.chat.id,
          bgg_id: gioco.bgg_id,
          nome: gioco.nome,
          stato: statoSpecificato ?? "da_comprare",
          aggiunto_da: ctx.from.id,
          aggiunto_da_nome: ctx.from.first_name
        });

        return ctx.reply(
          `${EMOJI_STATO[statoSpecificato ?? "da_comprare"]} *${gioco.nome}* aggiunto alla lista.`,
          { parse_mode: "Markdown" }
        );
      } catch (err) {
        if (err.code === 11000) {
          return ctx.reply(`"${gioco.nome}" è già in lista.`);
        }
        console.error("Errore /lista add:", err);
        return ctx.reply("⚠️ Errore nell'aggiunta, riprova tra poco.");
      }
    }

    // /lista remove nome_gioco
    if (sottocomando === "remove") {
      const nomeQuery = args.slice(1).join(" ").trim().toLowerCase();

      if (!nomeQuery) {
        return ctx.reply("Uso: /lista remove nome_gioco");
      }

      const rimosso = await ListaItem.findOneAndDelete({
        chat_id: ctx.chat.id,
        nome: { $regex: nomeQuery, $options: "i" }
      });

      if (!rimosso) {
        return ctx.reply(`Nessun gioco simile a "${nomeQuery}" trovato in lista.`);
      }

      return ctx.reply(`🗑 "${rimosso.nome}" rimosso dalla lista.`);
    }

    return ctx.reply(
      "Sottocomandi disponibili:\n" +
      "/lista — mostra la lista\n" +
      "/lista add nome_gioco [stato]\n" +
      "/lista remove nome_gioco"
    );
  });
}
