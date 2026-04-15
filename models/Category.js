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
});

module.exports = model("Category", CategorySchema, "categories");
