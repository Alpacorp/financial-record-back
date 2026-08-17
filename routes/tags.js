/*
  Routes tags database
  host + /api/v1/tags
*/

const { Router } = require("express");
const { check } = require("express-validator");
const { createTag, getTags, updateTag, deleteTag } = require("../controllers/tags");
const { validateInputs } = require("../middlewares/validateInputs");
const { validateJWT } = require("../middlewares/validateJWT");

const router = Router();

router.use(validateJWT);

router.post(
  "/new",
  [
    check("name", "name tag is required").notEmpty(),
    validateInputs,
  ],
  createTag
);
router.get("/", getTags);
router.put("/:id", updateTag);
router.delete("/:id", deleteTag);

module.exports = router;
