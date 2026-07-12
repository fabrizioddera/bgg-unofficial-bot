import "dotenv/config";
import { Telegraf } from "telegraf";
import { connectDB } from "./config/db.js";
import { registraComandoCerca } from "./commands/cerca.js";
import { registraComandoLista } from "./commands/lista.js";
import { registraComandoRegolamento } from "./commands/regolamento.js";

async function main() {
  if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN non impostato nel file .env");
  }

  await connectDB();

  const bot = new Telegraf(process.env.BOT_TOKEN);

  bot.start((ctx) =>
    ctx.reply(
      "🎲 Ciao! Sono il bot del gruppo giochi da tavolo.\n\n" +
      "Comandi disponibili:\n" +
      "/cerca nome_gioco — cerca info su BGG\n" +
      "/regolamento nome_gioco — link ai file/regolamenti su BGG\n" +
      "/lista — mostra la lista del gruppo\n" +
      "/lista add nome_gioco [posseduto|da_comprare|provato]\n" +
      "/lista remove nome_gioco"
    )
  );

  registraComandoCerca(bot);
  registraComandoLista(bot);
  registraComandoRegolamento(bot);

  bot.catch((err, ctx) => {
    console.error(`Errore non gestito per ${ctx.updateType}:`, err);
  });

  // bot.launch() risolve solo allo stop: non attenderlo, logga subito dopo
  bot.launch();
  console.log("🤖 Bot avviato");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((err) => {
  console.error("Errore fatale all'avvio:", err);
  process.exit(1);
});
