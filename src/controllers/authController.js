const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendResendEmail');
const crypto = require('crypto');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Please provide all fields' });
    }

    try {
        const userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const verificationToken = crypto.randomBytes(20).toString('hex');

        const user = await User.create({
            username,
            email,
            password,
            verificationToken
        });

        // Send verification email via Resend
        const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

        try {
            await sendEmail({
                to: user.email,
                subject: 'Welcome to SaaSForge - Verify Your Email',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                        <div style="background-color: #4f46e5; padding: 32px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to SaaSForge! 🚀</h1>
                        </div>
                        <div style="padding: 32px;">
                            <p style="font-size: 16px; color: #334155; line-height: 1.6;">Hi ${user.username},</p>
                            <p style="font-size: 16px; color: #334155; line-height: 1.6;">We're thrilled to have you on board! You're just one click away from starting your journey. Please verify your email address by clicking the button below:</p>
                            <div style="text-align: center; margin: 32px 0;">
                                <a href="${verifyUrl}" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify My Account</a>
                            </div>
                            <p style="font-size: 14px; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                                Or copy and paste this link into your browser:<br>
                                <a href="${verifyUrl}" style="color: #4f46e5; word-break: break-all;">${verifyUrl}</a>
                            </p>
                        </div>
                    </div>
                `
            });
        } catch (err) {
            // Email failed but user was created — don't crash registration
            console.error('Email send failed:', err.message);
            // Use updateOne to avoid triggering pre-save hook
            await User.updateOne({ _id: user._id }, { $unset: { verificationToken: 1 } });
        }

        res.status(201).json({
            message: 'Registration successful. Please check your email to verify your account.'
        });
    } catch (error) {
        console.error('Registration error:', error.message);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'User already exists' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Authenticate user & get tokens
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        // Use findByIdAndUpdate to avoid triggering pre-save password hash hook
        await User.findByIdAndUpdate(user._id, {
            $push: { refreshTokens: newRefreshToken }
        });

        // Set httpOnly cookie
        res.cookie('jwt', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            accessToken,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Refresh access token
// @route   GET /api/auth/refresh
// @access  Public (uses cookie)
const refreshAccessToken = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
        return res.status(401).json({ message: 'No refresh token' });
    }

    const refreshToken = cookies.jwt;

    try {
        const user = await User.findOne({ refreshTokens: refreshToken });

        // Token reuse detection
        if (!user) {
            try {
                const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
                // Valid token not in DB = possible theft. Clear all tokens.
                await User.findByIdAndUpdate(decoded.id, { $set: { refreshTokens: [] } });
            } catch (e) {
                // Token expired or invalid — ignore
            }
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Verify the token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch (err) {
            // Token expired — remove it
            await User.findByIdAndUpdate(user._id, {
                $pull: { refreshTokens: refreshToken }
            });
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (user._id.toString() !== decoded.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Generate new tokens
        const accessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        // Rotate: remove old, add new (atomic update, no pre-save hook)
        await User.findByIdAndUpdate(user._id, {
            $pull: { refreshTokens: refreshToken }
        });
        await User.findByIdAndUpdate(user._id, {
            $push: { refreshTokens: newRefreshToken }
        });

        // Set new cookie
        res.cookie('jwt', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            accessToken,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Refresh error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Logout user & clear tokens
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204);

    const refreshToken = cookies.jwt;

    try {
        await User.findOneAndUpdate(
            { refreshTokens: refreshToken },
            { $pull: { refreshTokens: refreshToken } }
        );

        res.clearCookie('jwt', {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            secure: process.env.NODE_ENV === 'production'
        });
        res.sendStatus(204);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify email
// @route   GET /api/auth/verify/:token
// @access  Public
const verifyEmail = async (req, res) => {
    try {
        const user = await User.findOneAndUpdate(
            { verificationToken: req.params.token },
            { $set: { isVerified: true }, $unset: { verificationToken: 1 } },
            { new: true }
        );

        if (!user) {
            return res.status(400).json({ message: 'Invalid verification token' });
        }

        res.status(200).json({ message: 'Email verified successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = user.getResetPasswordToken();
        // Use save here since we're modifying resetPasswordToken (not password)
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        try {
            await sendEmail({
                to: user.email,
                subject: 'SaaSForge - Password Reset Request',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #0f172a; padding: 32px; text-align: center; border-bottom: 4px solid #4f46e5;">
                            <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Password Reset</h1>
                        </div>
                        <div style="padding: 32px; background-color: #ffffff;">
                            <p style="font-size: 16px; color: #334155; line-height: 1.6;">Hello,</p>
                            <p style="font-size: 16px; color: #334155; line-height: 1.6;">We received a request to reset the password for your SaaSForge account. If you didn't initiate this request, you can safely ignore this email.</p>
                            
                            <div style="text-align: center; margin: 32px 0;">
                                <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
                            </div>
                            
                            <p style="font-size: 14px; color: #64748b; margin-top: 32px;">
                                <strong>Note:</strong> This link will expire in 10 minutes.
                            </p>
                        </div>
                    </div>
                `
            });
            res.status(200).json({ message: 'Email sent' });
        } catch (err) {
            await User.findByIdAndUpdate(user._id, {
                $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 }
            });
            return res.status(500).json({ message: 'Email could not be sent' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
const resetPassword = async (req, res) => {
    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex');

    try {
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        // Set new password — pre-save hook will hash it
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    verifyEmail,
    forgotPassword,
    resetPassword
};
