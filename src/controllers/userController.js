const User = require('../models/User');

// @desc    Get current user profile
// @route   GET /api/users/me
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -refreshTokens -resetPasswordToken -resetPasswordExpire -verificationToken');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user usage stats (Mocked for dashboard)
// @route   GET /api/users/usage
// @access  Private
const getUserUsage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isPro = user.role === 'admin'; // Using admin role as 'Pro' proxy for now based on previous setup

        // Mock data that changes based on plan
        const usage = {
            projects: {
                used: isPro ? 12 : 3,
                limit: isPro ? 'Unlimited' : 5,
                percentage: isPro ? 15 : 60 // Fake percentage if unlimited
            },
            apiCalls: {
                used: isPro ? 45200 : 1200,
                limit: isPro ? 100000 : 5000,
                percentage: isPro ? 45 : 24
            },
            storage: {
                used: isPro ? 4.2 : 0.2, // in GB
                limit: isPro ? 50 : 1, // in GB
                percentage: isPro ? 8.4 : 20
            }
        };

        res.json(usage);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getUserProfile,
    getUserUsage
};
