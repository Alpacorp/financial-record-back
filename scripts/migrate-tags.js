/**
 * Migración: convierte los checks fijos hasEInvoice / isChildrenExpense
 * en marcas del catálogo genérico (models/Tag.js).
 *
 * Para cada usuario que tenga gastos marcados:
 *   1. Crea la marca si no existe
 *   2. Añade el nombre de la marca al array `tags` de sus gastos
 *   3. Elimina el campo booleano del documento
 *
 * Es idempotente: se puede correr varias veces sin duplicar nada.
 * Con --dry-run solo informa lo que haría, sin escribir.
 *
 * Los booleanos ya no están en el schema de Bill, así que Mongoose los
 * filtraría de las queries y del $unset. Por eso todo lo que toca esos campos
 * usa la colección nativa (Bill.collection) en vez del modelo.
 *
 * Uso:
 *   node scripts/migrate-tags.js --dry-run
 *   node scripts/migrate-tags.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const Tag = require("../models/Tag");

const DRY_RUN = process.argv.includes("--dry-run");

const MIGRATIONS = [
  { field: "hasEInvoice",       name: "Factura electrónica", emoji: "🧾",
    description: "El gasto tiene soporte de factura electrónica, válido como deducible en renta." },
  { field: "isChildrenExpense", name: "Hijos",               emoji: "👧",
    description: "Gasto relacionado con los hijos: colegio, ropa, salud, actividades." },
];

async function migrate() {
  await mongoose.connect(process.env.DB_CNN);
  const bills = Bill.collection;
  console.log(`Connected to database${DRY_RUN ? " (DRY RUN — no se escribe nada)" : ""}\n`);

  for (const { field, name, emoji, description } of MIGRATIONS) {
    console.log(`── ${name} (${field}) ──`);

    // Los uid que tienen al menos un gasto con el check activo
    const uids = await bills.distinct("uid", { [field]: true });

    if (uids.length === 0) {
      console.log("  No hay gastos con este check. Nada que migrar.\n");
      continue;
    }

    for (const uid of uids) {
      const count = await bills.countDocuments({ uid, [field]: true });

      if (DRY_RUN) {
        const exists = await Tag.findOne({ uid, name });
        console.log(`  uid ${uid}: ${count} gasto(s) · marca ${exists ? "ya existe" : "se crearía"}`);
        continue;
      }

      // 1. Crear la marca si no existe
      await Tag.findOneAndUpdate(
        { uid, name },
        { $setOnInsert: { uid, name, emoji, description } },
        { upsert: true, new: true }
      );

      // 2. Añadirla a los gastos que la tienen ($addToSet evita duplicados
      //    si el script se corre más de una vez)
      const tagged = await bills.updateMany(
        { uid, [field]: true },
        { $addToSet: { tags: name } }
      );

      console.log(`  uid ${uid}: ${tagged.modifiedCount}/${count} gasto(s) marcados`);
    }
    console.log("");
  }

  // 3. Limpiar los campos booleanos ya migrados
  const pendingFilter = {
    $or: [{ hasEInvoice: { $exists: true } }, { isChildrenExpense: { $exists: true } }],
  };

  if (DRY_RUN) {
    const pending = await bills.countDocuments(pendingFilter);
    console.log(`Se limpiarían los booleanos de ${pending} gasto(s)`);
    console.log("\nDry run completo. Nada fue modificado.");
  } else {
    const cleaned = await bills.updateMany(
      pendingFilter,
      { $unset: { hasEInvoice: "", isChildrenExpense: "" } }
    );
    console.log(`Campos booleanos eliminados de ${cleaned.modifiedCount} gasto(s)`);
    console.log("\nMigración completa.");
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
