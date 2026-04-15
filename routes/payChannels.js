/*
  Routes payChannel database
  host + /api/v1/paychannels
*/

const { Router } = require("express");
const { check } = require("express-validator");
const {
  createPayChannel,
  getPayChannels,
  getPayChannel,
  updatePayChannel,
  deletePayChannel,
} = require("../controllers/payChannels");
const { validateInputs } = require("../middlewares/validateInputs");
const { validateJWT } = require("../middlewares/validateJWT");

const router = Router();

router.use(validateJWT);

router.post(
  "/new",
  [
    check("name", "name paychannel is required").notEmpty(),
    validateInputs,
  ],
  createPayChannel
);
router.get("/", getPayChannels);
router.get("/:id", getPayChannel);
router.put("/:id", updatePayChannel);
router.delete("/:id", deletePayChannel);

module.exports = router;
