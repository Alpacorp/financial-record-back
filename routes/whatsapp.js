const { Router } = require("express");
const { webhookHandler } = require("../controllers/whatsapp");

const router = Router();

// Twilio sends POST with URL-encoded body (not JSON)
// This endpoint has no JWT — authenticated via Twilio request signature
router.post("/webhook", webhookHandler);

module.exports = router;
