const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

let isDatabaseConnected = false;

mongoose.connection.on('connected', () => {
  isDatabaseConnected = true;
});

mongoose.connection.on('disconnected', () => {
  isDatabaseConnected = false;
  console.warn('MongoDB connection was lost.');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error.', {
    name: error.name,
    code: error.code,
  });
});

const logDatabaseFailure = (operation, error) => {
  console.error(`MongoDB ${operation} failed.`, {
    name: error.name,
    code: error.code,
  });
};

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    isDatabaseConnected = false;
    console.error('MongoDB connection is not configured: MONGO_URI is missing.');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    isDatabaseConnected = true;
    console.log('MongoDB connected.');
  } catch (error) {
    isDatabaseConnected = false;
    logDatabaseFailure('connection', error);
    console.warn('The API is running without persistent database access.');
    return;
  }

  try {
    const cleanup = await User.collection.updateMany(
      { otp: { $exists: true } },
      { $unset: { otp: '' } },
    );
    if (cleanup.modifiedCount > 0) {
      console.log('Removed legacy plaintext OTPs from existing accounts.');
    }
  } catch (error) {
    logDatabaseFailure('legacy OTP cleanup', error);
  }

  try {
    if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
      const email = process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        await User.create({
          name: process.env.SUPER_ADMIN_NAME || 'School Administrator',
          email,
          password: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 12),
          role: 'super-admin',
          isVerified: true,
        });
        console.log('Initial super-admin account created from environment configuration.');
      }
    }
  } catch (error) {
    logDatabaseFailure('super-admin initialization', error);
  }
};

module.exports = { connectDB, isDatabaseConnected: () => isDatabaseConnected };
