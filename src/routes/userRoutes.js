const express = require('express');
const router = express.Router();
const { getUserProfile, getUserUsage } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.get('/me', protect, getUserProfile);
router.get('/usage', protect, getUserUsage);

module.exports = router;
