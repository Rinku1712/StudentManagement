const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.join(__dirname, '.env'),
});

const express = require('express');
const cors = require('cors');

const { connectDB, isDatabaseConnected } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const classroomRoutes = require('./routes/classroomRoutes');

const app = express();
app.set('trust proxy', 1);

// ========================================
// DATABASE CONNECTION
// ========================================

connectDB();

// ========================================
// CORS
// ========================================

const allowedOrigins = [
  ...(process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim())
    : []),
  ...(process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173']),
].filter(Boolean);

const allowedOriginSet = new Set(allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an origin
      // Example: Postman, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOriginSet.has(origin)) {
        return callback(null, true);
      }

      console.warn('Blocked request from an origin not configured in CLIENT_ORIGIN.');

      return callback(new Error('Origin is not allowed by CORS.'));
    },

    credentials: true,
  ),
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
  const databaseConnected = isDatabaseConnected();
  const authConfigured =
    Boolean(process.env.JWT_SECRET) &&
    Boolean(process.env.OTP_SECRET && Buffer.byteLength(process.env.OTP_SECRET, 'utf8') >= 32) &&
    Boolean(process.env.RESEND_API_KEY) &&
    Boolean(process.env.EMAIL_FROM);
  const ready = databaseConnected && (process.env.NODE_ENV !== 'production' || authConfigured);
  res.status(ready ? 200 : 503).json({
    success: ready,
    database: databaseConnected ? 'connected' : 'unavailable',
    authentication: authConfigured ? 'configured' : 'incomplete',
    message: ready ? 'API dependencies are healthy.' : 'One or more required API dependencies are unavailable.',
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

app.use('/api/classrooms', classroomRoutes);

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
  const status = err.message === 'Origin is not allowed by CORS.' ? 403 : 500;
  console.error('Request middleware failed.', {
    name: err.name,
    code: err.code,
    status,
  });

  res.status(status).json({
    success: false,
    message:
      status === 403
        ? 'This frontend origin is not allowed. Configure CLIENT_ORIGIN on the backend.'
        : 'Internal server error.',
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
// AUTH AND EMAIL CONFIG CHECK
// ========================================

if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
  console.warn('⚠️ OTP email is unavailable. Configure RESEND_API_KEY and EMAIL_FROM.');
}
if (!process.env.OTP_SECRET || Buffer.byteLength(process.env.OTP_SECRET, 'utf8') < 32) {
  console.warn('⚠️ OTP verification is unavailable. Configure OTP_SECRET with at least 32 bytes.');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ Authentication is unavailable. Configure JWT_SECRET.');
}
