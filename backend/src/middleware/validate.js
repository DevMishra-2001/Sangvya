const { validationResult } = require("express-validator");

// Runs after an array of express-validator checks (see routes/*.js).
// If any check failed, respond with a 400 and stop — controllers only
// ever see already-valid input.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array();
    // First problem as the message (shown to the user in a toast); all of them in details
    return res.status(400).json({ error: details[0]?.msg || "Validation failed", details });
  }
  next();
}

module.exports = { validate };
