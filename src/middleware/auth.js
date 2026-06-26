const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

// Generate a signed token for a user
const generateToken = (userId) =>
  jwt.sign({ userId }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// Express middleware – protects routes that require authentication
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = { generateToken, authenticate };
