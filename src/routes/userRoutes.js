const express = require('express');
const router = express.Router();
const {
    getUserProfile,
    getUserUsage,
    updateUserProfile,
    updateUserPassword,
    deleteUserAccount
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const upload = require('../middleware/uploadMiddleware');

router.get('/me', protect, getUserProfile);
router.get('/usage', protect, getUserUsage);
router.put('/profile', protect, upload.single('avatar'), updateUserProfile);
router.put('/password', protect, updateUserPassword);
router.delete('/', protect, deleteUserAccount);

module.exports = router;
