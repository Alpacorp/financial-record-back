/**
 * One-time seed: populates categories and paychannels for the owner.
 * Safe to run multiple times — skips items that already exist (by name+uid+type).
 *
 * Usage:
 *   node scripts/seed-catalog.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const PayChannel = require("../models/PayChannel");

const OWNER_EMAIL = "alejandro.palacios88@gmail.com";

const EXPENSE_CATEGORIES = [
  "Apoyo Mamá", "Apoyo Papá", "Arriendo", "Carro", "Comida",
  "Cuotas", "Diversión", "Educación", "Hogar", "Impuestos",
  "Inversiones", "Mercado", "Plataformas Web", "Préstamos", "Ropa",
  "Salud", "Servicios Públicos", "Servicios Streaming", "Trabajo", "Transporte",
];

const INCOME_CATEGORIES = [
  "Salario", "Freelance", "Arriendo", "Inversiones",
  "Bonificación", "Venta", "Transferencia", "Otro",
];

const CASH_PAYMETHODS = [
  "Efectivo", "Débito", "Débito Davivienda", "Nequi", "Daviplata", "Rappy Cuenta",
];

const CREDIT_PAYMETHODS = [
  "TC Davivienda", "Daviplata", "Nu", "Rappy", "Rappy 2",
];

async function seed() {
  await mongoose.connect(process.env.DB_CNN);
  console.log("Connected to database");

  const user = await User.findOne({ email: OWNER_EMAIL });
  if (!user) {
    console.error(`User not found: ${OWNER_EMAIL}`);
    console.error("Register first through the app login screen.");
    process.exit(1);
  }

  const uid = user._id.toString();
  console.log(`Owner: ${user.name} (${uid})\n`);

  let catCreated = 0;
  let catSkipped = 0;

  for (const name of EXPENSE_CATEGORIES) {
    const exists = await Category.findOne({ uid, name, type: "gasto" });
    if (!exists) {
      await Category.create({ uid, name, type: "gasto" });
      catCreated++;
    } else {
      catSkipped++;
    }
  }

  for (const name of INCOME_CATEGORIES) {
    const exists = await Category.findOne({ uid, name, type: "ingreso" });
    if (!exists) {
      await Category.create({ uid, name, type: "ingreso" });
      catCreated++;
    } else {
      catSkipped++;
    }
  }

  console.log(`Categories — created: ${catCreated}, skipped: ${catSkipped}`);

  let pmCreated = 0;
  let pmSkipped = 0;

  for (const name of CASH_PAYMETHODS) {
    const exists = await PayChannel.findOne({ uid, name, type: "contado" });
    if (!exists) {
      await PayChannel.create({ uid, name, type: "contado" });
      pmCreated++;
    } else {
      pmSkipped++;
    }
  }

  for (const name of CREDIT_PAYMETHODS) {
    const exists = await PayChannel.findOne({ uid, name, type: "credito" });
    if (!exists) {
      await PayChannel.create({ uid, name, type: "credito" });
      pmCreated++;
    } else {
      pmSkipped++;
    }
  }

  console.log(`PayChannels  — created: ${pmCreated}, skipped: ${pmSkipped}`);
  console.log("\nSeed complete.");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
