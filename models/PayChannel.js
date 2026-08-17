const { Schema, model } = require("mongoose");

const payChannelSchema = Schema({
  uid: {
    type: String,
    required: false,
  },
  name: {
    type: String,
    required: [true, "The name is required"],
  },
  type: {
    type: String,
    enum: ["contado", "credito", "ambos"],
    default: "ambos",
    required: false,
  },
  // Marca los canales que son tarjeta de crédito: el gasto se causa al comprar,
  // pero el dinero sale de la caja cuando se paga la tarjeta (ver CardPayment).
  isCreditCard: {
    type: Boolean,
    default: false,
  },
});

module.exports = model("PayChannel", payChannelSchema, "paychannels");
