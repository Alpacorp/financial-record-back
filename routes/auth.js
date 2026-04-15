/*
  Routes auth database
  host + /api/v1/auth
*/

const { Router } = require("express");
const { check } = require("express-validator");
const router = Router();
const {
  createUser,
  loginUser,
  getUsers,
  getUser,
  renewToken,
  deleteUser,
  updateUser,
} = require("../controllers/auth");
const { validateInputs } = require("../middlewares/validateInputs");
const { validateJWT } = require("../middlewares/validateJWT");

router.post(
  "/new",
  [
    check("email", "email is required").isEmail(),
    check("password", "password is required")
      .not()
      .isEmpty()
      .isLength({ min: 6 }),
    validateInputs,
  ],
  createUser
);

router.post(
  "/",
  [
    check("email", "email is required").isEmail(),
    check("password", "password is required").notEmpty(),
    validateInputs,
  ],
  loginUser
);

router.use(validateJWT);

router.get("/users", getUsers);
router.get("/users/:id", getUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

router.get("/renew", [validateInputs], renewToken);

module.exports = router;
