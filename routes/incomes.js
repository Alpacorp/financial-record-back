/*
  Routes incomes database
  host + /api/v1/incomes
*/

const { Router } = require("express");
const { check } = require("express-validator");
const {
  createIncome,
  getIncomes,
  getIncome,
  updateIncome,
  deleteIncome,
} = require("../controllers/incomes");
const { validateInputs } = require("../middlewares/validateInputs");
const { validateJWT } = require("../middlewares/validateJWT");
const router = Router();

router.use(validateJWT);

router.post(
  "/new",
  [
    check("concept", "concept income is required").notEmpty(),
    check("detail", "detail income is required").notEmpty(),
    check("amount", "amount income is required").notEmpty(),
    check("date", "date income is required").notEmpty(),
    check("channel", "channel income is required").notEmpty(),
    check("paymethod", "paymethod income is required").notEmpty(),
    validateInputs,
  ],
  createIncome
);
router.get("/", getIncomes);
router.get("/:id", getIncome);
router.put("/:id", updateIncome);
router.delete("/:id", deleteIncome);

module.exports = router;
