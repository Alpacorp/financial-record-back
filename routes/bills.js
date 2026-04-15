/*
  Routes bills database
  host + /api/v1/bills
*/

const { Router } = require("express");
const { check } = require("express-validator");
const {
  createBill,
  getBills,
  getBill,
  updateBill,
  deleteBill,
} = require("../controllers/bills");
const { validateInputs } = require("../middlewares/validateInputs");
const { validateJWT } = require("../middlewares/validateJWT");
const router = Router();

// router.use(validateJWT);

router.post(
  "/new",
  [
    check("name", "name bill is required").notEmpty(),
    check("category", "category bill is required").notEmpty(),
    check("detail", "detail bill is required").notEmpty(),
    check("amount", "amount bill is required").notEmpty().isNumeric(),
    check("date", "date bill is required").notEmpty(),
    check("type", "type bill is required").notEmpty(),
    check("paymethod", "paymethod bill is required").notEmpty(),
    validateInputs,
  ],
  createBill
);
router.get("/", getBills);
router.get("/:id", getBill);
router.put("/:id", updateBill);
router.delete("/:id", deleteBill);

module.exports = router;
