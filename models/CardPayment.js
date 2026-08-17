const { Schema, model } = require("mongoose");

/*
  Pago a una tarjeta de crédito.

  NO es un gasto: el gasto ya se causó cuando se hizo la compra con la tarjeta.
  Este registro solo mueve dinero de la caja hacia la deuda de la tarjeta, así que
  nunca debe sumarse a los totales de gastos ni a los presupuestos por categoría.
  Solo afecta el flujo de caja del período y el saldo pendiente de la tarjeta.
*/
const CardPaymentSchema = Schema(
  {
    uid: { type: String, required: [true, "The uid is required"] },
    // Nombre del PayChannel de la tarjeta que se paga (mismo criterio que Bill.paymethod)
    card: { type: String, required: [true, "The card is required"] },
    amount: { type: Number, required: [true, "The amount is required"], min: 0 },
    // YYYY-MM-DD, igual que Bill.date e Income.date
    date: { type: String, required: [true, "The date is required"] },
    // Canal desde el que salió el dinero (cuenta, Nequi, efectivo…). Opcional.
    source: { type: String, default: "" },
    detail: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = model("CardPayment", CardPaymentSchema, "cardPayments");
