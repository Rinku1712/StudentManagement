const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

let isDatabaseConnected = false;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    isDatabaseConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

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
        console.log('✅ Initial super-admin account created from environment configuration.');
      }
    }
  } catch (error) {
    isDatabaseConnected = false;
    console.error(`⚠️ MongoDB Warning: ${error.message}`);
    console.log('👉 Server is running with temporary in-memory authentication storage.');
  }
};

module.exports = { connectDB, isDatabaseConnected: () => isDatabaseConnected };
