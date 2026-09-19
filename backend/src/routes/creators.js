const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creatorController');

router.get('/slug/:slug', creatorController.getCreatorBySlug);

module.exports = router;
