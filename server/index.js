const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.join(__dirname, '.env'),
  override: true,
});

const express = require('express');
const cors = require('cors');

const { connectDB } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const schoolRoutes = require('./routes/schoolRoutes');

const app = express();

// ========================================
// DATABASE CONNECTION
// ========================================

connectDB();

// ========================================
// CORS
// ========================================

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an origin
      // Example: Postman, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('Blocked CORS origin:', origin);

      return callback(new Error('Origin is not allowed by CORS.'));
    },

    credentials: true,
  }),
);

// ========================================
// BODY PARSER
// ========================================

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// ========================================
// ROOT ROUTE
// ========================================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Student Management API is running',
  });
});

// ========================================
// HEALTH CHECK
// ========================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy and running',
  });
});

// ========================================
// API ROUTES
// ========================================

app.use('/api/auth', authRoutes);

app.use('/api/ai', aiRoutes);

app.use('/api/dashboard', dashboardRoutes);

app.use('/api/profile', profileRoutes);

app.use('/api/school', schoolRoutes);

// ========================================
// 404 ROUTE
// ========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ========================================
// ERROR HANDLER
// ========================================

app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);

  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ========================================
// PORT
// ========================================

const PORT = process.env.PORT || 5000;

// ========================================
// SERVER START
// ========================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Port: ${PORT}`);
});

// ========================================
// EMAIL CONFIG CHECK
// ========================================

if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️ OTP email is not configured. Add EMAIL_HOST, EMAIL_USER, and EMAIL_PASS.');

  console.warn('👉 OTPs may only be printed in the terminal until SMTP is configured.');
}
