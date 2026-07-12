import mongoose from "mongoose";

const listaItemSchema = new mongoose.Schema({
  chat_id: { type: Number, required: true, index: true },
  bgg_id: { type: Number, required: true },
  nome: String, // denormalizzato per mostrare la lista senza join
  stato: {
    type: String,
    enum: ["posseduto", "da_comprare", "provato"],
    default: "da_comprare"
  },
  aggiunto_da: Number, // telegram user id
  aggiunto_da_nome: String,
  aggiunto_il: { type: Date, default: Date.now }
});

// Evita duplicati dello stesso gioco nello stesso gruppo
listaItemSchema.index({ chat_id: 1, bgg_id: 1 }, { unique: true });

export default mongoose.model("ListaItem", listaItemSchema);
