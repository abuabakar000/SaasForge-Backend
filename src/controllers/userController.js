const User = require('../models/User');
const Project = require('../models/Project');
const cloudinary = require('../config/cloudinary');

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

// @desc    Get user usage stats
// @route   GET /api/users/usage
// @access  Private
const getUserUsage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isPro = user.role === 'admin'; // Using admin role as 'Pro' proxy for now based on previous setup
        const projectCount = await Project.countDocuments({ user: req.user.id });
        const maxProjects = isPro ? 'Unlimited' : 3;

        // Calculate percentage (max out at 100%, handle Unlimited)
        let projectPercentage = 0;
        if (isPro) {
            // For unlimited, maybe just show a small chunk or 100% depending on UI preference. Let's do 100 if > 0 else 0, or just hardcode a visual pleasantry like 100 for Pro. We'll set 100.
            projectPercentage = projectCount > 0 ? 100 : 0;
        } else {
            projectPercentage = Math.min((projectCount / maxProjects) * 100, 100);
        }

        const usage = {
            projects: {
                used: projectCount,
                limit: maxProjects,
                percentage: projectPercentage
            },
            // Mock data for other resources to prevent UI breakage
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

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user) {
            user.username = req.body.username || user.username;
            user.email = req.body.email || user.email;

            if (req.file) {
                // If old avatar exists, destroy it from Cloudinary
                if (user.avatarUrl) {
                    const urlParts = user.avatarUrl.split('/');
                    const filenameWithExt = urlParts[urlParts.length - 1];
                    const publicId = `saasforge_avatars/${filenameWithExt.split('.')[0]}`;
                    try {
                        await cloudinary.uploader.destroy(publicId);
                    } catch (err) {
                        console.error("Cloudinary cleanup failed:", err);
                    }
                }
                user.avatarUrl = req.file.path; // Cloudinary URL
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                avatarUrl: updatedUser.avatarUrl
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        if (req.file) {
            await cloudinary.uploader.destroy(req.file.filename);
        }
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Identity handle or email already in use.' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user password
// @route   PUT /api/users/password
// @access  Private
const updateUserPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current access key is incorrect.' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Access protocol updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete user account
// @route   DELETE /api/users
// @access  Private
const deleteUserAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 1. Clean up project images from Cloudinary
        const projects = await Project.find({ user: req.user.id });
        for (const project of projects) {
            for (const imgUrl of project.images) {
                const urlParts = imgUrl.split('/');
                const filenameWithExt = urlParts[urlParts.length - 1];
                const publicId = `saasforge_projects/${filenameWithExt.split('.')[0]}`;
                try {
                    await cloudinary.uploader.destroy(publicId);
                } catch (err) {
                    console.error("Project image cleanup failed:", err);
                }
            }
        }

        // 2. Clean up user's avatar from Cloudinary
        if (user.avatarUrl) {
            const urlParts = user.avatarUrl.split('/');
            const filenameWithExt = urlParts[urlParts.length - 1];
            const publicId = `saasforge_avatars/${filenameWithExt.split('.')[0]}`;
            try {
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.error("Avatar cleanup failed:", err);
            }
        }

        // 3. Purge database records
        await Project.deleteMany({ user: req.user.id });
        await User.findByIdAndDelete(req.user.id);

        // 4. Clear JWT cookie
        res.clearCookie('jwt', {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            secure: process.env.NODE_ENV === 'production'
        });

        res.json({ message: 'System identity and all associated nodes fully nullified.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getUserProfile,
    getUserUsage,
    updateUserProfile,
    updateUserPassword,
    deleteUserAccount
};
