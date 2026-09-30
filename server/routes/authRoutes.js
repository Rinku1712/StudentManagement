const express = require('express');
const router = express.Router();
const { register, verifyOtp, resetPassword, forgotPassword, login } = require('../controllers/authController');

router.post('/signup', register);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/forgot-password', forgotPassword);
router.post('/login', login);

module.exports = router;
