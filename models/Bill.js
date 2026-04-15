const { Schema, model } = require("mongoose");

const BillSchema = Schema({
  uid: {
    type: String,
    required: false,
  },
  name: {
    type: String,
    required: [true, "The name is required"],
  },
  category: {
    type: String,
    required: [true, "The category is required"],
  },
  detail: {
    type: String,
    required: [true, "The detail is required"],
  },
  amount: {
    type: Number,
    required: [true, "The amount is required"],
  },
  date: {
    type: String,
    required: [true, "The date is required"],
  },
  type: {
    type: String,
    required: [true, "The type is required"],
  },
  paymethod: {
    type: String,
    required: [true, "The paymethod is required"],
  },
  dues: {
    type: Number,
    required: false,
  },
});

module.exports = model("Bill", BillSchema, "bills");
