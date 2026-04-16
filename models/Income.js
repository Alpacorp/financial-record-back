const { Schema, model } = require("mongoose");

const IncomeSchema = Schema(
  {
    uid: { type: String, required: false },
    concept: { type: String, required: [true, "The concept is required"] },
    detail: { type: String, required: [true, "The detail is required"] },
    amount: { type: Number, required: [true, "The amount is required"] },
    date: { type: String, required: [true, "The date is required"] },
    category: { type: String, required: false },
    channel: { type: String, required: [true, "The channel is required"] },
    paymethod: { type: String, required: [true, "The paymethod is required"] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = model("Income", IncomeSchema, "incomes");
