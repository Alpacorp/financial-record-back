/*
  Routes cardPayments database
  host + /api/v1/card-payments
*/

const { Router } = require("express");
const { check } = require("express-validator");
const {
  createCardPayment,
  getCardPayments,
  updateCardPayment,
  deleteCardPayment,
} = require("../controllers/cardPayments");
const { validateInputs } = require("../middlewares/validateInputs");
const { validateJWT } = require("../middlewares/validateJWT");

const router = Router();

router.use(validateJWT);

router.post(
  "/new",
  [
    check("card", "card is required").notEmpty(),
    check("amount", "amount is required").notEmpty().isNumeric(),
    check("date", "date is required").notEmpty(),
    validateInputs,
  ],
  createCardPayment
);
router.get("/", getCardPayments);
router.put("/:id", updateCardPayment);
router.delete("/:id", deleteCardPayment);

module.exports = router;
