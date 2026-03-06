const Project = require('../models/Project');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');

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
            console.log(`[PLAN ENFORCEMENT] User: ${req.user.username}, Role: ${req.user.role}, Current Projects: ${projectCount}`);

            if (projectCount >= 3) {
                console.warn(`[DENIED] User ${req.user.username} reached project limit (3/3)`);
                // If they uploaded files but hit the limit, delete the new files from Cloudinary
                if (req.files) {
                    for (const file of req.files) {
                        await cloudinary.uploader.destroy(file.filename);
                    }
                }
                return res.status(403).json({ message: 'Free plan is limited to 3 project nodes. Upgrade to Pro for unlimited access.' });
            }
        }

        const { name, description, githubLink, liveLink } = req.body;

        if (!name || !description) {
            // Local file deletion is not needed since it's Cloudinary, but we should destroy the uploaded file
            if (req.files) {
                for (const file of req.files) {
                    await cloudinary.uploader.destroy(file.filename);
                }
            }
            return res.status(400).json({ message: 'Please provide name and description' });
        }

        // Handle Image Uploads
        let images = [];
        if (req.files && req.files.length > 0) {
            if (!isPro && req.files.length > 1) {
                // Keep only the first file, delete the rest for free tier
                const keptFile = req.files[0];
                for (let i = 1; i < req.files.length; i++) {
                    await cloudinary.uploader.destroy(req.files[i].filename);
                }
                images.push(keptFile.path); // Cloudinary URL is in path
            } else {
                images = req.files.map(file => file.path); // Cloudinary URL
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

        // SUCCESS NOTIFICATION
        await Notification.create({
            user: req.user.id,
            title: 'Project Node Initialized 🚀',
            message: `Your project "${name}" has been successfully broadcasted to the system nodes.`,
            type: 'success',
            link: '/'
        });

        // PREMIUM UPSELL NOTIFICATION
        if (!isPro) {
            await Notification.create({
                user: req.user.id,
                title: 'Unlock Unlimited Power ⚡',
                message: 'You are currently on the Free Protocol. Upgrade to Pro for unlimited project nodes and priority neural bandwidth.',
                type: 'promo',
                link: '/pricing'
            });
        }

        res.status(201).json(project);
    } catch (error) {
        if (req.files) {
            for (const file of req.files) {
                await cloudinary.uploader.destroy(file.filename);
            }
        }
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
            for (const imgUrl of imagesToRemove) {
                // Extract public ID from Cloudinary URL
                // e.g. https://res.cloudinary.com/user/image/upload/v1234/folder/id.jpg
                const urlParts = imgUrl.split('/');
                const filenameWithExt = urlParts[urlParts.length - 1];
                const publicId = `saasforge_projects/${filenameWithExt.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
            }
            newImages = newImages.filter(img => !imagesToRemove.includes(img));
        }

        // 2. Add newly uploaded images
        if (req.files && req.files.length > 0) {
            const uploadedUrls = req.files.map(file => file.path); // Cloudinary URL

            // Re-enforce free tier image limit (max 1 total image on the record)
            const totalImages = newImages.length + uploadedUrls.length;
            if (!isPro && totalImages > 1) {
                console.warn(`[DENIED] User ${req.user.username} attempted to upload ${totalImages} images (Limit: 1)`);
                for (const file of req.files) {
                    await cloudinary.uploader.destroy(file.filename);
                }
                return res.status(403).json({ message: 'Free plan limits you to 1 total image per project. Purge old images or upgrade to Pro.' });
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
        if (req.files) {
            for (const file of req.files) {
                await cloudinary.uploader.destroy(file.filename);
            }
        }
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

        // Clean up stored image files from Cloudinary
        for (const imgUrl of project.images) {
            const urlParts = imgUrl.split('/');
            const filenameWithExt = urlParts[urlParts.length - 1];
            const publicId = `saasforge_projects/${filenameWithExt.split('.')[0]}`;
            await cloudinary.uploader.destroy(publicId);
        }

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
