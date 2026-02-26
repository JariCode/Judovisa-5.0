// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Kaikki reitit vaativat kirjautumisen
router.use(protect);

router.patch('/me', userController.updateMe);
router.patch('/me/password', userController.changePassword);
router.delete('/me', userController.deleteMe);
router.get('/me/scores', userController.getMyScores);

module.exports = router;
