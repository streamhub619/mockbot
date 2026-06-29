require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { pool }       = require('./config/db');
const errorHandler   = require('./middleware/errorhandler');

const authRoutes     = require('./routes/auth.routes');
const resumeRoutes   = require('./routes/resume.routes');
const jdRoutes       = require('./routes/jd.routes');
const sessionRoutes  = require('./routes/session.routes');
const answerRoutes   = require('./routes/answer.routes');
const rouletteRoutes = require('./routes/roulette.routes');

const app  = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static serving for uploaded resumes (authenticated access only — see route below)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth',              authRoutes);
app.use('/api/resumes',           resumeRoutes);
app.use('/api/job-descriptions',  jdRoutes);
app.use('/api/sessions',          sessionRoutes);
app.use('/api/answers',           answerRoutes);
app.use('/api/roulette',          rouletteRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Global Error Handler
app.use(errorHandler);

// Start
app.listen(PORT, () => {
  console.log(`\n  MockBot API running on http://localhost:${PORT}`);
  console.log(`  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Database    : ${process.env.DB_NAME || 'mockbot_db'}\n`);
});

module.exports = app;


