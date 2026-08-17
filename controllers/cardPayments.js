const { response } = require("express");
const CardPayment = require("../models/CardPayment");

const createCardPayment = async (req, res = response) => {
  const { card, amount, date, source, detail } = req.body;

  try {
    const newCardPayment = new CardPayment({
      uid: req.uid,
      card, amount, date, source, detail,
    });
    await newCardPayment.save();
    res.status(201).json({ ok: true, msg: "Card payment created", cardPayment: newCardPayment });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const getCardPayments = async (req, res = response) => {
  if (!req.uid) {
    return res.status(401).json({ ok: false, msg: "Unauthorized" });
  }
  const cardPayments = await CardPayment.find({ uid: req.uid, deletedAt: null }).sort({ date: -1 });
  res.json({ ok: true, cardPayments });
};

const updateCardPayment = async (req, res = response) => {
  const { id } = req.params;
  try {
    const cardPayment = await CardPayment.findOne({ _id: id, uid: req.uid, deletedAt: null });
    if (!cardPayment) {
      return res.status(404).json({ ok: false, msg: "Card payment not found" });
    }
    const updated = await CardPayment.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ ok: true, msg: "Card payment updated", cardPayment: updated });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const deleteCardPayment = async (req, res = response) => {
  const { id } = req.params;
  try {
    const cardPayment = await CardPayment.findOne({ _id: id, uid: req.uid, deletedAt: null });
    if (!cardPayment) {
      return res.status(404).json({ ok: false, msg: "Card payment not found" });
    }
    await CardPayment.findByIdAndUpdate(id, { deletedAt: new Date() });
    res.json({ ok: true, msg: "Card payment deleted" });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

module.exports = { createCardPayment, getCardPayments, updateCardPayment, deleteCardPayment };
