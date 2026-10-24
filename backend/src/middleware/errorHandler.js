// Catches errors passed via next(err) from anywhere in the app, plus
// anything thrown inside async route handlers (see utils/asyncHandler.js).
// Keeping this in one place means every route returns errors in the same
// shape instead of each controller inventing its own.
function errorHandler(err, req, res, next) {
  console.error(err);

  // Postgres unique-constraint violation (e.g. duplicate email)
  if (err.code === "23505") {
    if (err.constraint === "idx_employees_code") {
      return res.status(409).json({ error: "This employee code is already used by another employee" });
    }
    return res.status(409).json({ error: "This record already exists" });
  }

  // Postgres foreign-key violation (e.g. referencing a deleted employee)
  if (err.code === "23503") {
    return res.status(400).json({ error: "Related record not found" });
  }

  const status = err.status || 500;
  const message = status === 500 ? "Something went wrong on our end" : err.message;
  res.status(status).json({ error: message });
}

// 404 handler for unmatched routes
function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

module.exports = { errorHandler, notFound };
