const { Schema, model } = require("mongoose");

const PendingExpenseSchema = Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  recordType: {
    type: String,
    enum: ["expense", "income"],
    default: "expense",
  },
  parsed: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300,
  },
});

module.exports = model("PendingExpense", PendingExpenseSchema, "pendingExpenses");
