const { response } = require("express");
const Tag = require("../models/Tag");
const Bill = require("../models/Bill");

const createTag = async (req, res = response) => {
  const { name, emoji, description } = req.body;
  try {
    const tag = new Tag({
      uid: req.uid,
      name: (name ?? "").trim(),
      emoji: emoji ?? "",
      description: description ?? "",
    });
    const tagDB = await tag.save();
    res.status(201).json({ ok: true, tag: tagDB });
  } catch (error) {
    // Índice único (uid, name)
    if (error.code === 11000) {
      return res.status(400).json({ ok: false, msg: "Ya tienes una marca con ese nombre" });
    }
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const getTags = async (req, res = response) => {
  if (!req.uid) return res.status(401).json({ ok: false, msg: "Unauthorized" });
  const tags = await Tag.find({ uid: req.uid }).sort({ name: 1 });
  res.json({ ok: true, tags });
};

const updateTag = async (req, res = response) => {
  const { id } = req.params;
  const { name, emoji, description } = req.body;

  try {
    const tag = await Tag.findOne({ _id: id, uid: req.uid });
    if (!tag) return res.status(404).json({ ok: false, msg: "Tag not found" });

    // Solo se tocan los campos presentes: el emoji y la descripción se guardan
    // por separado desde la UI y no deben borrarse entre sí.
    const changes = {};
    if (name !== undefined)        changes.name = String(name).trim();
    if (emoji !== undefined)       changes.emoji = emoji;
    if (description !== undefined) changes.description = description;

    const previousName = tag.name;
    const tagUpdated = await Tag.findByIdAndUpdate(id, changes, { new: true });

    // Los gastos guardan la marca por nombre: al renombrar hay que arrastrarlos,
    // o quedarían apuntando a una marca que ya no existe.
    let billsUpdated = 0;
    if (changes.name && changes.name !== previousName) {
      const result = await Bill.updateMany(
        { uid: req.uid, tags: previousName },
        { $set: { "tags.$[old]": changes.name } },
        { arrayFilters: [{ old: previousName }] }
      );
      billsUpdated = result.modifiedCount;
    }

    res.json({ ok: true, msg: "Tag updated", tag: tagUpdated, billsUpdated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ ok: false, msg: "Ya tienes una marca con ese nombre" });
    }
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const deleteTag = async (req, res = response) => {
  const { id } = req.params;
  try {
    const tag = await Tag.findOne({ _id: id, uid: req.uid });
    if (!tag) return res.status(404).json({ ok: false, msg: "Tag not found" });

    // Quitar la marca de todos los gastos antes de borrarla
    const result = await Bill.updateMany(
      { uid: req.uid, tags: tag.name },
      { $pull: { tags: tag.name } }
    );
    await Tag.findByIdAndDelete(id);

    res.json({ ok: true, msg: "Tag deleted", billsUpdated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

module.exports = { createTag, getTags, updateTag, deleteTag };
