const express = require('express');
const multer = require('multer');
const photobookController = require('../controllers/photobookController');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 120 * 1024 * 1024,
    fieldSize: 4 * 1024 * 1024,
  },
});

router.post('/feedback', optionalAuth, photobookController.submitEditorFeedback);

router.use(authenticate);

router.get('/projects', photobookController.listProjects);
router.get('/projects/:id', photobookController.getProject);
router.delete('/projects/:id', photobookController.deleteProject);

router.post(
  '/projects',
  upload.fields([{ name: 'preview', maxCount: 1 }]),
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
  photobookController.saveProject,
);

router.put(
  '/projects/:id',
  upload.fields([{ name: 'preview', maxCount: 1 }]),
  (req, res, next) => {
    req.body.projectId = req.params.id;
    if (typeof req.body?.projectJson === 'string') {
      try {
        req.body.projectJson = JSON.parse(req.body.projectJson);
      } catch {
        /* service validates */
      }
    }
    next();
  },
  photobookController.saveProject,
);

router.post(
  '/projects/:id/images',
  upload.single('image'),
  photobookController.uploadImage,
);

router.post('/projects/:id/add-to-cart', photobookController.addToCart);

router.post(
  '/projects/:id/finalize',
  upload.single('printPdf'),
  photobookController.finalizeProject,
);

module.exports = router;
