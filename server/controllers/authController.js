const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dataStore, createId } = require('../dataStore');
const { isDatabaseConnected } = require('../config/db');
const { EmailDeliveryError, sendOtpEmail } = require('../services/emailService');
const { generateOtp, hashOtp, isOtpExpired, matchesOtp } = require('../services/otpService');

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_RESENDS_PER_HOUR = 5;
const OTP_RESEND_WINDOW_MS = 60 * 60 * 1000;
const OTP_FIELDS = ['otpHash', 'otpExpires', 'otpPurpose', 'otpAttempts'];

const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isDatabaseUnavailableError = (error) =>
  [
    'MongoNetworkError',
    'MongoServerSelectionError',
    'MongooseServerSelectionError',
  ].includes(error.name) ||
  ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH'].includes(error.code) ||
  (error.name === 'MongooseError' && /buffering timed out/i.test(error.message || ''));

const requirePersistentAuthStorage = (res) => {
  if (process.env.NODE_ENV === 'production' && !isDatabaseConnected()) {
    res.status(503).json({
      message: 'Authentication storage is temporarily unavailable. Please retry shortly.',
    });
    return false;
  }
  return true;
};

const findUserByEmail = async (email) => {
  if (isDatabaseConnected()) return User.findOne({ email });
  return dataStore.users.find((user) => user.email === email);
};

const saveUser = async (user) => {
  if (isDatabaseConnected()) await user.save();
};

const clearOtp = (user) => {
  user.otpHash = null;
  user.otpExpires = null;
  user.otpPurpose = null;
  user.otpAttempts = 0;
};

const clearedOtpValues = {
  otpHash: null,
  otpExpires: null,
  otpPurpose: null,
  otpAttempts: 0,
};

const clearExpiredOtp = async (user, purpose) => {
  if (isDatabaseConnected()) {
    await User.updateOne(
      {
        _id: user._id,
        otpHash: user.otpHash,
        otpPurpose: purpose,
        otpExpires: { $lte: new Date() },
      },
      { $set: clearedOtpValues },
    );
    return;
  }
  clearOtp(user);
  await saveUser(user);
};

const recordFailedOtpAttempt = async (user, purpose) => {
  if (isDatabaseConnected()) {
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        otpHash: user.otpHash,
        otpPurpose: purpose,
        otpExpires: { $gt: new Date() },
        otpAttempts: { $lt: OTP_MAX_ATTEMPTS },
      },
      { $inc: { otpAttempts: 1 } },
      { new: true },
    );
    if (!updatedUser) return null;

    const locked = updatedUser.otpAttempts >= OTP_MAX_ATTEMPTS;
    if (locked) {
      await User.updateOne(
        { _id: user._id, otpHash: user.otpHash, otpAttempts: { $gte: OTP_MAX_ATTEMPTS } },
        { $set: clearedOtpValues },
      );
    }
    return locked;
  }

  user.otpAttempts = (Number(user.otpAttempts) || 0) + 1;
  const locked = user.otpAttempts >= OTP_MAX_ATTEMPTS;
  if (locked) clearOtp(user);
  await saveUser(user);
  return locked;
};

const consumeOtp = async (user, purpose, updates = {}) => {
  if (isDatabaseConnected()) {
    const result = await User.updateOne(
      {
        _id: user._id,
        isVerified: purpose === 'verification' ? false : true,
        otpHash: user.otpHash,
        otpPurpose: purpose,
        otpExpires: { $gt: new Date() },
        otpAttempts: { $lt: OTP_MAX_ATTEMPTS },
      },
      { $set: { ...clearedOtpValues, ...updates } },
    );
    return result.modifiedCount === 1;
  }

  Object.assign(user, updates);
  clearOtp(user);
  await saveUser(user);
  return true;
};

const createOtp = (purpose) => {
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  return {
    otp,
    otpHash,
    otpPurpose: purpose,
    otpExpires: new Date(Date.now() + OTP_LIFETIME_MS),
  };
};

const deliverReplacementOtp = async (user, purpose) => {
  const now = Date.now();
  const lastSentAt = user.otpLastSentAt ? new Date(user.otpLastSentAt).getTime() : NaN;
  if (Number.isFinite(lastSentAt) && now - lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000);
    const error = new Error(`Please wait ${retryAfterSeconds} seconds before requesting another code.`);
    error.statusCode = 429;
    throw error;
  }

  let windowStartedAt = user.otpResendWindowStartedAt
    ? new Date(user.otpResendWindowStartedAt).getTime()
    : NaN;
  let resendCount = Number(user.otpResendCount) || 0;
  if (!Number.isFinite(windowStartedAt) || now - windowStartedAt >= OTP_RESEND_WINDOW_MS) {
    windowStartedAt = now;
    resendCount = 0;
  }
  if (resendCount >= OTP_MAX_RESENDS_PER_HOUR) {
    const error = new Error('You have requested too many codes. Please try again later.');
    error.statusCode = 429;
    throw error;
  }

  const previousOtpFields = Object.fromEntries(OTP_FIELDS.map((field) => [field, user[field]]));
  const replacement = createOtp(purpose);

  user.otpHash = replacement.otpHash;
  user.otpExpires = replacement.otpExpires;
  user.otpPurpose = purpose;
  user.otpAttempts = 0;
  user.otpLastSentAt = new Date(now);
  user.otpResendWindowStartedAt = new Date(windowStartedAt);
  user.otpResendCount = resendCount + 1;
  await saveUser(user);

  try {
    await sendOtpEmail({ email: user.email, otp: replacement.otp, purpose });
  } catch (error) {
    Object.assign(user, previousOtpFields);
    try {
      await saveUser(user);
    } catch {
      console.error('Could not restore prior OTP state after an email delivery failure.');
      throw new Error('Email delivery failed and the prior verification state could not be restored.');
    }
    throw error;
  }
};

const respondWithError = (res, error, fallbackMessage) => {
  if (error.code === 11000) {
    return res.status(409).json({
      code: 'ACCOUNT_EXISTS',
      message: 'An account already uses this email address.',
    });
  }

  const databaseUnavailable = isDatabaseUnavailableError(error);
  const status = databaseUnavailable
    ? 503
    : Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500;
  console.error('Authentication request failed.', {
    name: error.name,
    code: error.code,
    status,
    databaseConnected: isDatabaseConnected(),
  });
  const message =
    databaseUnavailable
      ? 'Database temporarily unavailable. Please retry shortly.'
      : error instanceof EmailDeliveryError || status === 429 || status === 503
      ? error.message
      : fallbackMessage;
  return res.status(status).json({ message });
};

exports.register = async (req, res) => {
  try {
    if (!requirePersistentAuthStorage(res)) return;
    const { name, email, password, role } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (typeof name !== 'string' || !name.trim() || !isValidEmail(normalizedEmail) || typeof password !== 'string') {
      return res.status(400).json({ message: 'Provide a name, valid email, and password.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }
    if (role && !['student', 'teacher', 'parent'].includes(role)) {
      return res.status(400).json({ message: 'Invalid account role.' });
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({
        code: existingUser.isVerified ? 'ACCOUNT_EXISTS' : 'ACCOUNT_UNVERIFIED',
        message: existingUser.isVerified
          ? 'An account already uses this email address. Please sign in or reset your password.'
          : 'An unverified account already uses this email. Continue to verification or request a new code.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role || 'student',
      isVerified: false,
      otpHash,
      otpExpires: new Date(Date.now() + OTP_LIFETIME_MS),
      otpPurpose: 'verification',
      otpAttempts: 0,
      otpLastSentAt: new Date(),
      otpResendCount: 0,
      otpResendWindowStartedAt: new Date(),
      academicProfile: { isCompleted: false, subjects: [] },
    };

    let user;
    if (isDatabaseConnected()) {
      user = await User.create(userData);
    } else {
      user = { ...userData, _id: createId() };
      dataStore.users.push(user);
    }

    try {
      await sendOtpEmail({ email: normalizedEmail, otp });
    } catch (error) {
      try {
        if (isDatabaseConnected()) {
          await User.deleteOne({ _id: user._id, isVerified: false });
        } else {
          const userIndex = dataStore.users.indexOf(user);
          if (userIndex !== -1) dataStore.users.splice(userIndex, 1);
        }
      } catch (cleanupError) {
        console.error('Could not remove an unverified account after email delivery failed.', {
          name: cleanupError.name,
          code: cleanupError.code,
        });
        const cleanupFailure = new Error(
          'Email delivery failed and signup cleanup could not be completed. Please contact support.',
        );
        cleanupFailure.statusCode = 500;
        throw cleanupFailure;
      }
      throw error;
    }

    return res.status(201).json({
      message: 'Verification email accepted. Check your inbox for the code.',
      email: normalizedEmail,
    });
  } catch (error) {
    return respondWithError(res, error, 'Unable to create the account or send its verification email.');
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    if (!requirePersistentAuthStorage(res)) return;
    const { email, otp } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail) || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Provide a valid email and 6-digit code.' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isVerified) {
      return res.status(409).json({ message: 'This email has already been verified. Please sign in.' });
    }
    if (user.otpPurpose !== 'verification' || !user.otpHash || !user.otpExpires) {
      return res.status(400).json({ message: 'No active verification code. Request a new code.' });
    }
    if (isOtpExpired(user.otpExpires)) {
      await clearExpiredOtp(user, 'verification');
      return res.status(400).json({ message: 'This verification code has expired. Request a new one.' });
    }
    if ((Number(user.otpAttempts) || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' });
    }
    if (!matchesOtp(otp, user.otpHash)) {
      const locked = await recordFailedOtpAttempt(user, 'verification');
      if (locked === null) {
        return res.status(409).json({ message: 'This verification code is no longer active. Request a new one.' });
      }
      return res.status(locked ? 429 : 400).json({
        message: locked
          ? 'Too many incorrect attempts. Request a new code.'
          : 'The verification code is incorrect.',
      });
    }

    const consumed = await consumeOtp(user, 'verification', { isVerified: true });
    if (!consumed) {
      return res.status(409).json({ message: 'This verification code was already used or has expired.' });
    }
    return res.status(200).json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (error) {
    return respondWithError(res, error, 'Failed to verify the email code.');
  }
};

exports.resendOtp = async (req, res) => {
  try {
    if (!requirePersistentAuthStorage(res)) return;
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Provide a valid email address.' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) return res.status(404).json({ message: 'No account exists with that email.' });
    if (user.isVerified) {
      return res.status(409).json({ message: 'This email has already been verified. Please sign in.' });
    }
    await deliverReplacementOtp(user, 'verification');

    return res.status(200).json({
      message: 'Verification email accepted. Check your inbox for the new code.',
      email: user.email,
    });
  } catch (error) {
    return respondWithError(res, error, 'Unable to resend the verification email.');
  }
};

exports.resetPassword = async (req, res) => {
  try {
    if (!requirePersistentAuthStorage(res)) return;
    const { email, otp, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail) || typeof otp !== 'string' || !/^\d{6}$/.test(otp) || typeof password !== 'string') {
      return res.status(400).json({ message: 'Provide a valid email, 6-digit code, and new password.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Verify your email before resetting the password.' });
    }
    if (user.otpPurpose !== 'reset' || !user.otpHash || !user.otpExpires) {
      return res.status(400).json({ message: 'No active password-reset code. Request a new one.' });
    }
    if (isOtpExpired(user.otpExpires)) {
      await clearExpiredOtp(user, 'reset');
      return res.status(400).json({ message: 'This reset code has expired. Request a new one.' });
    }
    if ((Number(user.otpAttempts) || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' });
    }
    if (!matchesOtp(otp, user.otpHash)) {
      const locked = await recordFailedOtpAttempt(user, 'reset');
      if (locked === null) {
        return res.status(409).json({ message: 'This reset code is no longer active. Request a new one.' });
      }
      return res.status(locked ? 429 : 400).json({
        message: locked
          ? 'Too many incorrect attempts. Request a new code.'
          : 'The reset code is incorrect.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const consumed = await consumeOtp(user, 'reset', { password: passwordHash });
    if (!consumed) {
      return res.status(409).json({ message: 'This reset code was already used or has expired.' });
    }
    return res.status(200).json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    return respondWithError(res, error, 'Failed to reset the password.');
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    if (!requirePersistentAuthStorage(res)) return;
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Provide a valid email address.' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) return res.status(404).json({ message: 'No account exists with that email.' });
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Verify your email before requesting a password-reset code.' });
    }

    await deliverReplacementOtp(user, 'reset');
    return res.status(200).json({
      message: 'Password-reset email accepted. Check your inbox for the code.',
      email: user.email,
    });
  } catch (error) {
    return respondWithError(res, error, 'Unable to send the password-reset email.');
  }
};

exports.login = async (req, res) => {
  try {
    if (!requirePersistentAuthStorage(res)) return;
    const { email, password, role } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail) || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'A valid email and password are required.' });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ message: 'Authentication is not configured on the server.' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) return res.status(400).json({ message: 'Invalid email or credentials.' });
    if (role && user.role !== role) {
      return res.status(400).json({ message: `Access denied. Registered role is ${user.role}.` });
    }
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password.' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
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
    return respondWithError(res, error, 'Login failed.');
  }
};
