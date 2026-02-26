// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Tiukempi rate limit kirjautumiselle (brute force suoja)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuuttia
  max: 10,
  message: { success: false, message: 'Liikaa yrityksiä - odota 15 minuuttia' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 tunti
  max: 3,
  message: { success: false, message: 'Liikaa salasanan palautuspyyntöjä' },
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', protect, authController.logout);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', passwordLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', protect, authController.getMe);

module.exports = router;
