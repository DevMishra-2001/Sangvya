const { query } = require("../config/db");

const PasswordResetModel = {
  // Replaces any earlier request for this user with a fresh OTP.
  async create(userId, otpHash, otpExpiresAt) {
    await query(`DELETE FROM password_resets WHERE user_id = $1`, [userId]);
    const res = await query(
      `INSERT INTO password_resets (user_id, otp_hash, otp_expires_at) VALUES ($1, $2, $3) RETURNING *`,
      [userId, otpHash, otpExpiresAt]
    );
    return res.rows[0];
  },

  async latestForUser(userId) {
    const res = await query(
      `SELECT * FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return res.rows[0];
  },

  async incrementAttempts(id) {
    const res = await query(
      `UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
      [id]
    );
    return res.rows[0]?.attempts;
  },

  async markVerified(id, resetTokenHash, resetExpiresAt) {
    await query(
      `UPDATE password_resets SET verified_at = now(), reset_token_hash = $2, reset_expires_at = $3 WHERE id = $1`,
      [id, resetTokenHash, resetExpiresAt]
    );
  },

  // A verified, unused, unexpired request matching the reset token.
  async findValidByToken(resetTokenHash) {
    const res = await query(
      `SELECT * FROM password_resets
       WHERE reset_token_hash = $1 AND used_at IS NULL AND reset_expires_at > now()`,
      [resetTokenHash]
    );
    return res.rows[0];
  },

  async markUsed(id) {
    await query(`UPDATE password_resets SET used_at = now() WHERE id = $1`, [id]);
  },
};

module.exports = PasswordResetModel;
