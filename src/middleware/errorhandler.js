// Central error handler – must be registered LAST in Express middleware chain.
// All unhandled errors eventually land here via next(err).

const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} →`, err.message);

  // Postgres unique constraint violation
  if (err.code === '23505') {
    const field = err.detail?.match(/\((.+?)\)/)?.[1] || 'field';
    return res.status(409).json({ error: `${field} already exists.` });
  }

  // Postgres foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource does not exist.' });
  }

  // Multer file too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    const maxMB = process.env.MAX_FILE_SIZE_MB || 5;
    return res.status(413).json({ error: `File too large. Maximum size is ${maxMB} MB.` });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field in upload.' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message    = statusCode < 500 ? err.message : 'Internal server error.';

  return res.status(statusCode).json({ error: message });
};

module.exports = errorHandler;
