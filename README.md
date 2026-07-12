# bgg-bot

Bot Telegram per gruppi di giochi da tavolo: ricerca su BoardGameGeek, lista giochi del gruppo, link ai regolamenti.

## Setup

1. Crea un bot con [@BotFather](https://t.me/BotFather) e copia il token
2. Copia `.env.example` in `.env` e compila `BOT_TOKEN` e `MONGO_URI`
3. Installa le dipendenze:
   ```
   npm install
   ```
4. Avvia:
   ```
   npm start
   ```

## Comandi

- `/cerca nome_gioco` — cerca un gioco su BGG e mostra info (giocatori, durata, complessità, immagine)
- `/regolamento nome_gioco` — link diretto alla sezione file/regolamenti su BGG
- `/lista` — mostra la lista giochi del gruppo, divisa per stato
- `/lista add nome_gioco [posseduto|da_comprare|provato]` — aggiunge un gioco alla lista (default: da_comprare)
- `/lista remove nome_gioco` — rimuove un gioco dalla lista (match parziale sul nome)

## Note tecniche

- L'API `thing` di BGG a volte risponde `202` mentre elabora la richiesta: `dettagliGioco` fa polling automatico (max 5 tentativi, 1.5s di attesa).
- I dettagli gioco vengono salvati in cache su Mongo per 7 giorni per ridurre le chiamate a BGG.
- Il bot non ospita PDF di regolamenti: rimanda sempre alla pagina ufficiale BGG `files`, per evitare problemi di copyright.

## Prossimi passi possibili

- Deploy (Railway, Render, VPS con PM2)
- Comando `/lista stato nome_gioco nuovo_stato` per cambiare stato senza rimuovere/riaggiungere
- Autocomplete inline quando la ricerca BGG restituisce più risultati ambigui
