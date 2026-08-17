const { Schema, model } = require("mongoose");

/*
  Marca aplicable a un gasto (factura electrónica, hijos, trabajo…).

  Un gasto puede llevar varias marcas a la vez, así que en Bill se guardan por
  nombre en `tags`. Al renombrar o borrar una marca hay que sincronizar los
  gastos que la usan — de eso se encarga controllers/tags.js.
*/
const TagSchema = Schema(
  {
    uid: { type: String, required: [true, "The uid is required"] },
    name: { type: String, required: [true, "The name is required"], trim: true },
    emoji: { type: String, default: "" },
    // Pista para que la IA sepa cuándo aplicar la marca al interpretar
    // lenguaje natural desde la app o desde WhatsApp.
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

// Una marca por nombre y usuario
TagSchema.index({ uid: 1, name: 1 }, { unique: true });

module.exports = model("Tag", TagSchema, "tags");
