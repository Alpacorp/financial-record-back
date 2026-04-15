/*
  Routes AI
  host + /api/v1/ai
*/

const { Router } = require("express");
const { check } = require("express-validator");
const { parseExpense } = require("../controllers/ai");
const { validateInputs } = require("../middlewares/validateInputs");
const { validateJWT } = require("../middlewares/validateJWT");

const router = Router();

router.use(validateJWT);

router.post(
  "/parse-expense",
  [
    check("text", "text is required").notEmpty(),
    validateInputs,
  ],
  parseExpense
);

module.exports = router;
