const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    verifyEmail,
    forgotPassword,
    resetPassword,
    sendVerificationEmail
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/refresh', refreshAccessToken);
router.post('/logout', logoutUser);
router.get('/verify/:token', verifyEmail);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:token', resetPassword);
router.post('/send-verification-email', protect, sendVerificationEmail);

module.exports = router;
