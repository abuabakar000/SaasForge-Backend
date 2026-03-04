const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - Verify Access Token
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

            req.user = await User.findById(decoded.id).select('-password');
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Role-based access control
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: `Role ${req.user.role} is not authorized to access this route` });
        }
        next();
    };
};

// Ownership validation (e.g., user can only edit their own profile)
const validateOwnership = (req, res, next) => {
    if (req.user.role === 'admin') {
        return next(); // Admins bypass ownership checks
    }

    if (req.params.id && req.user._id.toString() !== req.params.id) {
        return res.status(403).json({ message: 'Not authorized to access this resource' });
    }
    next();
};

module.exports = { protect, authorize, validateOwnership };
