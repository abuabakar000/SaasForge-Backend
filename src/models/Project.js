const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    name: {
        type: String,
        required: [true, 'Please add a project name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    description: {
        type: String,
        required: [true, 'Please add a description'],
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    images: {
        type: [String], // Array of image URLs/paths
        validate: [arrayLimit, 'Exceeds the limit of images allowed per plan']
    },
    githubLink: {
        type: String,
        match: [
            /https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/,
            'Please enter a valid GitHub repository URL'
        ]
    },
    liveLink: {
        type: String,
        match: [
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/,
            'Please enter a valid HTTP/HTTPS URL'
        ]
    },
    isFeatured: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

function arrayLimit(val) {
    // Basic validation, strict plan enforcement happens in the controller
    return val.length <= 10;
}

module.exports = mongoose.model('Project', projectSchema);
