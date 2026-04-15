const { response } = require("express");
const PayChannel = require("../models/PayChannel");

const createPayChannel = async (req, res = response) => {
  try {
    const payChannel = new PayChannel({ uid: req.uid, ...req.body });
    const payChannelDB = await payChannel.save();
    res.status(201).json({ ok: true, payChannel: payChannelDB });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const getPayChannels = async (req, res = response) => {
  if (!req.uid) return res.status(401).json({ ok: false, msg: "Unauthorized" });
  const payChannels = await PayChannel.find({ uid: req.uid }).sort({ name: 1 });
  res.json({ ok: true, payChannels });
};

const getPayChannel = async (req, res = response) => {
  const { id } = req.params;
  try {
    const payChannel = await PayChannel.findOne({ _id: id, uid: req.uid });
    if (!payChannel) return res.status(404).json({ ok: false, msg: "PayChannel not found" });
    res.json({ ok: true, payChannel });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const updatePayChannel = async (req, res = response) => {
  const { id } = req.params;
  try {
    const payChannel = await PayChannel.findOne({ _id: id, uid: req.uid });
    if (!payChannel) return res.status(404).json({ ok: false, msg: "PayChannel not found" });
    const payChannelUpdated = await PayChannel.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ ok: true, payChannel: payChannelUpdated });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const deletePayChannel = async (req, res = response) => {
  const { id } = req.params;
  try {
    const payChannel = await PayChannel.findOne({ _id: id, uid: req.uid });
    if (!payChannel) return res.status(404).json({ ok: false, msg: "PayChannel not found" });
    await PayChannel.findByIdAndDelete(id);
    res.json({ ok: true, msg: "PayChannel deleted" });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

module.exports = { createPayChannel, getPayChannels, getPayChannel, updatePayChannel, deletePayChannel };
