const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { dataStore } = require('../dataStore');
const { isDatabaseConnected } = require('../config/db');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey2026');
    const user = isDatabaseConnected()
      ? await User.findById(decoded.id).select('-password')
      : dataStore.users.find((storedUser) => String(storedUser._id) === String(decoded.id));

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You are not authorized to access this resource.' });
  }
  return next();
};

module.exports = { protect, authorizeRoles };
