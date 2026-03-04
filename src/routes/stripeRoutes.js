const express = require('express');
const router = express.Router();
const { createCheckoutSession, handleWebhook } = require('../controllers/stripeController');
const { protect } = require('../middleware/authMiddleware');

// Webhook needs raw body, we'll handle this in index.js for this specific route
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);
router.post('/create-checkout-session', protect, createCheckoutSession);

module.exports = router;
