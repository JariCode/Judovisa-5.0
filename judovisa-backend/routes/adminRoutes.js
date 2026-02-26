// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Kaikki admin-reitit vaativat kirjautumisen JA admin-roolin
router.use(protect, adminOnly);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id', adminController.updateUser);
router.patch('/users/:id/role', adminController.changeUserRole);
router.delete('/users/:id', adminController.deleteUser);
router.get('/logs', adminController.getLogs);

module.exports = router;
