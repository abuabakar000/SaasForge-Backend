const Project = require('../models/Project');
const fs = require('fs');
const path = require('path');

// @desc    Get all active user's projects
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
    try {
        const projects = await Project.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
const createProject = async (req, res) => {
    try {
        // Enforce Plan Limits
        const isPro = req.user.role === 'admin';

        if (!isPro) {
            const projectCount = await Project.countDocuments({ user: req.user.id });
            if (projectCount >= 3) {
                // If they uploaded files but hit the limit, delete the new files
                if (req.files) {
                    req.files.forEach(file => fs.unlinkSync(file.path));
                }
                return res.status(403).json({ message: 'Free plan is limited to 3 projects. Please upgrade to Pro.' });
            }
        }

        const { name, description, githubLink, liveLink } = req.body;

        if (!name || !description) {
            if (req.files) req.files.forEach(file => fs.unlinkSync(file.path));
            return res.status(400).json({ message: 'Please provide name and description' });
        }

        // Handle Image Uploads
        let images = [];
        if (req.files && req.files.length > 0) {
            if (!isPro && req.files.length > 1) {
                // Keep only the first file, delete the rest for free tier
                const keptFile = req.files[0];
                for (let i = 1; i < req.files.length; i++) {
                    fs.unlinkSync(req.files[i].path);
                }
                images.push(`/uploads/${keptFile.filename}`);
            } else {
                images = req.files.map(file => `/uploads/${file.filename}`);
            }
        }

        const project = await Project.create({
            user: req.user.id,
            name,
            description,
            githubLink,
            liveLink,
            images,
            isFeatured: isPro && req.body.isFeatured === 'true', // Only Pro can set featured
        });

        res.status(201).json(project);
    } catch (error) {
        if (req.files) req.files.forEach(file => fs.unlinkSync(file.path));
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private
const updateProject = async (req, res) => {
    try {
        let project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Ensure user owns the project
        if (project.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized to update this project' });
        }

        const isPro = req.user.role === 'admin';
        const { name, description, githubLink, liveLink, removeImages } = req.body;

        let newImages = project.images;

        // 1. Handle deletion of old images
        if (removeImages) {
            const imagesToRemove = Array.isArray(removeImages) ? removeImages : [removeImages];
            imagesToRemove.forEach(img => {
                const filePath = path.join(__dirname, '../../', img);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
            newImages = newImages.filter(img => !imagesToRemove.includes(img));
        }

        // 2. Add newly uploaded images
        if (req.files && req.files.length > 0) {
            const uploadedUrls = req.files.map(file => `/uploads/${file.filename}`);

            // Re-enforce free tier image limit (max 1 total image on the record)
            if (!isPro && (newImages.length + uploadedUrls.length) > 1) {
                req.files.forEach(file => fs.unlinkSync(file.path)); // rollback uploads
                return res.status(403).json({ message: 'Free plan limits you to 1 total image per project.' });
            }

            newImages = [...newImages, ...uploadedUrls];
        }

        project.name = name || project.name;
        project.description = description || project.description;
        project.githubLink = githubLink || project.githubLink;
        project.liveLink = liveLink || project.liveLink;
        project.images = newImages;

        if (isPro && req.body.isFeatured !== undefined) {
            project.isFeatured = req.body.isFeatured === 'true';
        }

        const updatedProject = await project.save();
        res.json(updatedProject);

    } catch (error) {
        if (req.files) req.files.forEach(file => fs.unlinkSync(file.path));
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private
const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Ensure user owns project
        if (project.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized to delete' });
        }

        // Clean up stored image files
        project.images.forEach(img => {
            const filePath = path.join(__dirname, '../../', img);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });

        await project.deleteOne();
        res.json({ id: req.params.id, message: 'Project deleted' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getProjects,
    createProject,
    updateProject,
    deleteProject
};
