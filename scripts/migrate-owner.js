/**
 * One-time migration: assigns all bills and incomes that lack a uid
 * to the specified owner email address.
 *
 * Usage:
 *   node scripts/migrate-owner.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Bill = require("../models/Bill");
const Income = require("../models/Income");

const OWNER_EMAIL = "alejandro.palacios88@gmail.com";

async function migrate() {
  await mongoose.connect(process.env.DB_CNN);
  console.log("Connected to database");

  const user = await User.findOne({ email: OWNER_EMAIL });
  if (!user) {
    console.error(`User not found: ${OWNER_EMAIL}`);
    console.error("Make sure you have registered with that email first.");
    process.exit(1);
  }

  const uid = user._id.toString();
  console.log(`Owner found: ${user.name} (${uid})`);

  const bills = await Bill.updateMany(
    { uid: { $exists: false } },
    { $set: { uid } }
  );
  const incomes = await Income.updateMany(
    { uid: { $exists: false } },
    { $set: { uid } }
  );

  console.log(`Bills updated:   ${bills.modifiedCount}`);
  console.log(`Incomes updated: ${incomes.modifiedCount}`);
  console.log("Migration complete.");

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
