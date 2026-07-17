import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const BASE_URL = "https://boardgamegeek.com/xmlapi2";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

// Da fine ottobre 2025 BGG richiede registrazione + token per la XML API.
// Registra l'app su https://boardgamegeek.com/applications, genera un token
// e mettilo in .env come BGG_TOKEN. Header richiesto: "Authorization: Bearer <token>".
// Dominio SENZA www: boardgamegeek.com
const api = axios.create({
  baseURL: BASE_URL,
  headers: process.env.BGG_TOKEN
    ? { Authorization: `Bearer ${process.env.BGG_TOKEN}` }
    : {}
});

if (!process.env.BGG_TOKEN) {
  console.warn(
    "⚠️  BGG_TOKEN non impostato: le richieste alla XML API di BGG falliranno con 401.\n" +
    "   Registra l'app su https://boardgamegeek.com/applications e imposta BGG_TOKEN nel file .env"
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Esegue una singola chiamata /search e normalizza i risultati.
async function searchRaw(query, exact) {
  const params = { query, type: "boardgame" };
  if (exact) params.exact = 1;

  const { data } = await api.get("/search", { params });
  const parsed = parser.parse(data);
  const items = parsed?.items?.item;
  if (!items) return [];

  const lista = Array.isArray(items) ? items : [items];
  return lista.map((item) => ({
    bgg_id: Number(item["@_id"]),
    nome: item.name?.["@_value"] ?? item.name?.[0]?.["@_value"] ?? "Sconosciuto",
    anno: item.yearpublished ? Number(item.yearpublished["@_value"]) : null
  }));
}

/**
 * Cerca giochi per nome su BGG.
 * Prima il match esatto (BGG exact=1), poi quello fuzzy: i risultati esatti
 * vengono messi in cima, il resto in coda, senza duplicati.
 * Ritorna un array di { bgg_id, nome, anno } (max 8).
 */
export async function cercaGiochi(query) {
  const [esatti, fuzzy] = await Promise.all([
    searchRaw(query, true),
    searchRaw(query, false)
  ]);

  const visti = new Set();
  const uniti = [];
  for (const gioco of [...esatti, ...fuzzy]) {
    if (visti.has(gioco.bgg_id)) continue;
    visti.add(gioco.bgg_id);
    uniti.push(gioco);
  }

  return uniti.slice(0, 8);
}

/**
 * Recupera i dettagli di un gioco dato il suo bgg_id.
 * L'endpoint "thing" a volte risponde 202 (elaborazione in corso):
 * in quel caso si fa polling con piccoli ritardi.
 */
export async function dettagliGioco(bggId, tentativiMax = 5) {
  for (let tentativo = 0; tentativo < tentativiMax; tentativo++) {
    const response = await api.get("/thing", {
      params: { id: bggId, stats: 1 },
      validateStatus: () => true // gestiamo noi lo status code
    });

    if (response.status === 202) {
      await sleep(1500);
      continue;
    }

    if (response.status !== 200) {
      throw new Error(`BGG ha risposto con status ${response.status}`);
    }

    const parsed = parser.parse(response.data);
    const item = parsed?.items?.item;
    if (!item) return null;

    const nomi = Array.isArray(item.name) ? item.name : [item.name];
    const nomePrimario = nomi.find((n) => n["@_type"] === "primary")?.["@_value"] ?? nomi[0]?.["@_value"];

    return {
      bgg_id: Number(bggId),
      nome: nomePrimario,
      anno: item.yearpublished ? Number(item.yearpublished["@_value"]) : null,
      immagine_url: item.image ?? null,
      durata_min: item.minplaytime ? Number(item.minplaytime["@_value"]) : null,
      durata_max: item.maxplaytime ? Number(item.maxplaytime["@_value"]) : null,
      eta_minima: item.minage ? Number(item.minage["@_value"]) : null,
      giocatori_min: item.minplayers ? Number(item.minplayers["@_value"]) : null,
      giocatori_max: item.maxplayers ? Number(item.maxplayers["@_value"]) : null,
      peso: item.statistics?.ratings?.averageweight
        ? Number(item.statistics.ratings.averageweight["@_value"]).toFixed(2)
        : null
    };
  }

  throw new Error("BGG non ha risposto in tempo utile dopo il polling");
}

/**
 * Link diretto alla sezione file (regolamenti, FAQ, traduzioni) di un gioco su BGG.
 */
const LANG_ITALIANO = "2193"; // languageid BGG per l'italiano

// Converte "Brass: Birmingham" -> "brass-birmingham" (slug URL BGG).
function slugify(nome) {
  return (nome ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // rimuove accenti
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Link alla sezione file del gioco, filtrata per lingua (default: italiano).
// Lo slug del nome è necessario: senza, BGG redirige alla pagina gioco e
// perde il tab file. Passa lingua=null per tutti i file senza filtro.
export function linkFilesBGG(bggId, nome = "", lingua = LANG_ITALIANO) {
  const slug = slugify(nome);
  const base = `https://boardgamegeek.com/boardgame/${bggId}${slug ? `/${slug}` : ""}/files`;
  return lingua ? `${base}?pageid=1&languageid=${lingua}` : base;
}

/**
 * Elenca i file di un gioco (regolamenti, riassunti, FAQ, traduzioni).
 * Filtra per lingua (default italiano); passa lingua=null per tutte.
 * Ordina per voti positivi. Ritorna [{ titolo, voti, url }].
 *
 * NB: usa l'endpoint privato api.geekdo.com/api/files. Uso personale, pochi hit/giorno.
 */
export async function elencoFileBGG(bggId, lingua = LANG_ITALIANO, max = 10) {
  const params = {
    objectid: bggId,
    objecttype: "thing",
    pageid: 1,
    showcount: 40,
    sort: "hot"
  };
  if (lingua) params.languageid = lingua;

  // Piccolo retry: la rete verso geekdo a volte fa i capricci.
  let data;
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    try {
      const res = await axios.get("https://api.geekdo.com/api/files", {
        params,
        timeout: 15000,
        headers: {
          "User-Agent": "bgg-unofficial-bot",
          ...(process.env.BGG_TOKEN ? { Authorization: `Bearer ${process.env.BGG_TOKEN}` } : {})
        }
      });
      data = res.data;
      break;
    } catch (err) {
      if (tentativo === 3) throw err;
      await sleep(1000);
    }
  }

  const files = Array.isArray(data?.files) ? data.files : [];
  return files
    .sort((a, b) => (Number(b.numpositive) || 0) - (Number(a.numpositive) || 0))
    .slice(0, max)
    .map((f) => ({
      titolo: f.title || f.filename || "File",
      voti: Number(f.numpositive) || 0,
      url: `https://boardgamegeek.com${f.href}`
    }));
}
