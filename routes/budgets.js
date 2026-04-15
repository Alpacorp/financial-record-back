/*
  Routes budgets
  host + /api/v1/budgets
*/

const { Router } = require("express");
const { check } = require("express-validator");
const { getBudgets, saveBudget, deleteBudget } = require("../controllers/budgets");
const { validateInputs } = require("../middlewares/validateInputs");
const { validateJWT }    = require("../middlewares/validateJWT");

const router = Router();

router.use(validateJWT);

router.get("/", getBudgets);

router.post(
  "/",
  [
    check("category", "category is required").notEmpty(),
    check("amount", "amount is required").isNumeric(),
    validateInputs,
  ],
  saveBudget
);

router.delete("/:id", deleteBudget);

module.exports = router;
