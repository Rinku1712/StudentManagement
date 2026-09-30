const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dataStore, createId } = require('../dataStore');
const { isDatabaseConnected } = require('../config/db');
const { sendOtpEmail } = require('../services/emailService');

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    if (role && !['student', 'teacher', 'parent'].includes(role)) {
      return res.status(400).json({ message: 'Invalid account role.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = isDatabaseConnected()
      ? await User.findOne({ email: normalizedEmail })
      : dataStore.users.find((user) => user.email === normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const generatedOtp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role || 'student',
      isVerified: false,
      otp: generatedOtp,
      otpExpires: otpExpiry,
      academicProfile: { isCompleted: false, subjects: [] },
    };

    if (!isDatabaseConnected()) userData._id = createId();

    await sendOtpEmail({ email: normalizedEmail, otp: generatedOtp });

    const user = isDatabaseConnected() ? await User.create(userData) : userData;
    if (!isDatabaseConnected()) dataStore.users.push(user);

    return res.status(201).json({
      message: 'Account created! Please verify OTP sent to email.',
      email: user.email,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to register user.' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const user = isDatabaseConnected()
      ? await User.findOne({ email: email.trim().toLowerCase() })
      : dataStore.users.find((storedUser) => storedUser.email === email.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.otp !== otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    if (isDatabaseConnected()) await user.save();

    return res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to verify OTP.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = isDatabaseConnected()
      ? await User.findOne({ email: normalizedEmail })
      : dataStore.users.find((storedUser) => storedUser.email === normalizedEmail);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.otp !== otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.otp = null;
    user.otpExpires = null;
    if (isDatabaseConnected()) await user.save();

    return res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to reset password.' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = isDatabaseConnected()
      ? await User.findOne({ email: email.trim().toLowerCase() })
      : dataStore.users.find((storedUser) => storedUser.email === email.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({ message: 'No account exists with that email.' });
    }

    const generatedOtp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await sendOtpEmail({ email: user.email, otp: generatedOtp, purpose: 'reset' });

    user.otp = generatedOtp;
    user.otpExpires = otpExpiry;
    if (isDatabaseConnected()) await user.save();

    return res.status(200).json({
      message: 'Reset code sent. Use the OTP to continue.',
      email: user.email,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to send reset code.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = isDatabaseConnected()
      ? await User.findOne({ email: email.trim().toLowerCase() })
      : dataStore.users.find((storedUser) => storedUser.email === email.trim().toLowerCase());
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or credentials' });
    }

    if (role && user.role !== role) {
      return res.status(400).json({ message: `Access denied. Registered role is ${user.role}` });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secretkey2026',
      { expiresIn: '7d' },
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        academicProfile: user.academicProfile || { isCompleted: false, subjects: [] },
        teacherProfile: user.teacherProfile || { isCompleted: false, subjects: [] },
        parentProfile: user.parentProfile || { students: [] },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Login failed.' });
  }
};
