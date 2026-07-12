import mongoose from "mongoose";

const giocoSchema = new mongoose.Schema({
  bgg_id: { type: Number, required: true, unique: true, index: true },
  nome: String,
  anno: Number,
  immagine_url: String,
  durata_min: Number,
  durata_max: Number,
  eta_minima: Number,
  peso: Number, // complessità BGG (1-5)
  giocatori_min: Number,
  giocatori_max: Number,
  cached_at: { type: Date, default: Date.now }
});

export default mongoose.model("Gioco", giocoSchema);
