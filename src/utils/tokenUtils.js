const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user._id.toString(), role: user.role || 'user' },
        (process.env.ACCESS_TOKEN_SECRET || 'fallback_secret').trim(),
        { expiresIn: (process.env.ACCESS_TOKEN_EXPIRY || '15m').trim() }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id.toString() },
        (process.env.REFRESH_TOKEN_SECRET || 'fallback_secret').trim(),
        { expiresIn: (process.env.REFRESH_TOKEN_EXPIRY || '7d').trim() }
    );
};

module.exports = {
    generateAccessToken,
    generateRefreshToken
};
