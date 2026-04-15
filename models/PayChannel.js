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
});

module.exports = model("PayChannel", payChannelSchema, "paychannels");
