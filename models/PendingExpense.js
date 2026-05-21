const { Schema, model } = require("mongoose");

const PendingExpenseSchema = Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  parsed: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // MongoDB elimina el documento automáticamente a los 5 minutos
  },
});

module.exports = model("PendingExpense", PendingExpenseSchema, "pendingExpenses");
