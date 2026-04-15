const { response } = require("express");
const Category = require("../models/Category");

const createCategory = async (req, res = response) => {
  try {
    const category = new Category({ uid: req.uid, ...req.body });
    const categoryDB = await category.save();
    res.status(201).json({ ok: true, category: categoryDB });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const getCategories = async (req, res = response) => {
  if (!req.uid) return res.status(401).json({ ok: false, msg: "Unauthorized" });
  const categories = await Category.find({ uid: req.uid }).sort({ name: 1 });
  res.json({ ok: true, categories });
};

const getCategory = async (req, res = response) => {
  const { id } = req.params;
  try {
    const category = await Category.findOne({ _id: id, uid: req.uid });
    if (!category) return res.status(404).json({ ok: false, msg: "Category not found" });
    res.json({ ok: true, category });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const updateCategory = async (req, res = response) => {
  const { id } = req.params;
  try {
    const category = await Category.findOne({ _id: id, uid: req.uid });
    if (!category) return res.status(404).json({ ok: false, msg: "Category not found" });
    const categoryUpdated = await Category.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ ok: true, category: categoryUpdated });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

const deleteCategory = async (req, res = response) => {
  const { id } = req.params;
  try {
    const category = await Category.findOne({ _id: id, uid: req.uid });
    if (!category) return res.status(404).json({ ok: false, msg: "Category not found" });
    await Category.findByIdAndDelete(id);
    res.json({ ok: true, msg: "Category deleted" });
  } catch (error) {
    res.status(500).json({ ok: false, msg: "Please contact the administrator" });
  }
};

module.exports = { createCategory, getCategories, getCategory, updateCategory, deleteCategory };
