const { Schema, model } = require("mongoose");

const BudgetSchema = Schema({
  uid: {
    type: String,
    required: [true, "The uid is required"],
  },
  category: {
    type: String,
    required: [true, "The category is required"],
  },
  amount: {
    type: Number,
    required: [true, "The amount is required"],
    min: 0,
  },
});

// One budget per category per user
BudgetSchema.index({ uid: 1, category: 1 }, { unique: true });

module.exports = model("Budget", BudgetSchema, "budgets");
