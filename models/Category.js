const { Schema, model } = require("mongoose");

const CategorySchema = Schema({
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
    enum: ["gasto", "ingreso"],
    default: "gasto",
    required: false,
  },
  isInvestment: {
    type: Boolean,
    default: false,
  },
  emoji: {
    type: String,
    default: "",
  },
});

module.exports = model("Category", CategorySchema, "categories");
