const { response } = require("express");
const Budget = require("../models/Budget");

const getBudgets = async (req, res = response) => {
  if (!req.uid) return res.status(401).json({ ok: false, msg: "Unauthorized" });
  const budgets = await Budget.find({ uid: req.uid });
  res.json({ ok: true, budgets });
};

// Upsert: creates if not exists, updates if it does
const saveBudget = async (req, res = response) => {
  const { category, amount } = req.body;
  try {
    const budget = await Budget.findOneAndUpdate(
      { uid: req.uid, category },
      { uid: req.uid, category, amount },
      { upsert: true, new: true }
    );
    res.json({ ok: true, budget });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const deleteBudget = async (req, res = response) => {
  const { id } = req.params;
  try {
    const budget = await Budget.findOne({ _id: id, uid: req.uid });
    if (!budget) return res.status(404).json({ ok: false, msg: "Budget not found" });
    await Budget.findByIdAndDelete(id);
    res.json({ ok: true, msg: "Budget deleted" });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

module.exports = { getBudgets, saveBudget, deleteBudget };
