const path = require('path');
const dotenv = require('dotenv');

// Explicit path to .env file inside server directory
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const schoolRoutes = require('./routes/schoolRoutes');

// Connect to Database
connectDB();

const app = express();

// Middleware
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true,
  }),
);
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/school', schoolRoutes);

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'API is healthy and running' });
});

const PORT = process.env.PORT || 5000;

if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn(
    '⚠️ OTP email is not configured. Add EMAIL_HOST, EMAIL_USER, and EMAIL_PASS to server/.env.',
  );
  console.warn('👉 OTPs will only be printed in this terminal until SMTP is configured.');
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
