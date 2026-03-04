const express = require('express');
const router = express.Router();
const { getProjects, createProject, updateProject, deleteProject } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/')
    .get(protect, getProjects)
    // maxCount limits the absolute maximum files Multer will process
    // Our controller further filters this to 1 for free users
    .post(protect, upload.array('images', 5), createProject);

router.route('/:id')
    .put(protect, upload.array('images', 5), updateProject)
    .delete(protect, deleteProject);

module.exports = router;
