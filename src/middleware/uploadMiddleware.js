const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const path = require('path');

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'saasforge_projects',
        allowed_formats: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
        transformation: [{ width: 1200, crop: 'limit' }] // basic optimization
    }
});

// File Filter (Images Only)
const fileFilter = (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files (jpeg, jpg, png, webp, gif) are allowed!'), false);
    }
};

// Initialize upload middleware
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
    fileFilter: fileFilter
});

module.exports = upload;
