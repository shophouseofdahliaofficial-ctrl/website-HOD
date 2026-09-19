const express = require('express');
const multer = require('multer');
const photoboothController = require('../controllers/photoboothController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 120 * 1024 * 1024,
    fieldSize: 2 * 1024 * 1024,
  },
});

router.get('/config', photoboothController.getConfig);

router.use(authenticate);

router.get('/projects', photoboothController.getMyProjects);
router.get('/projects/:id', photoboothController.getProject);
router.delete('/projects/:id', photoboothController.deleteProject);

router.post(
  '/projects',
  upload.single('printPdf'),
  (req, res, next) => {
    if (typeof req.body?.projectJson === 'string') {
      try {
        req.body.projectJson = JSON.parse(req.body.projectJson);
      } catch {
        /* service validates */
      }
    }
    next();
  },
  photoboothController.createProject,
);

module.exports = router;
