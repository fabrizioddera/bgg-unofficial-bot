# Bot Telegram BGG (polling) — immagine Node slim
FROM node:22-slim

WORKDIR /app

# Installa solo le dipendenze di produzione
COPY package*.json ./
RUN npm ci --omit=dev

# Codice
COPY . .

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
