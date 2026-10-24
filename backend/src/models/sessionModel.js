const { query } = require("../config/db");

const SessionModel = {
  async create({ userId, refreshTokenHash, expiresAt, userAgent, ip }) {
    const res = await query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, expires_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, refreshTokenHash, expiresAt, userAgent, ip]
    );
    return res.rows[0];
  },

  // The session whose current refresh token matches.
  async findByTokenHash(hash) {
    const res = await query(`SELECT * FROM user_sessions WHERE refresh_token_hash = $1`, [hash]);
    return res.rows[0];
  },

  // The session whose PREVIOUS refresh token matches (it was just rotated, or stolen).
  async findByPreviousHash(hash) {
    const res = await query(`SELECT * FROM user_sessions WHERE previous_token_hash = $1`, [hash]);
    return res.rows[0];
  },

  async findById(id) {
    const res = await query(`SELECT * FROM user_sessions WHERE id = $1`, [id]);
    return res.rows[0];
  },

  // New refresh token in, old one kept briefly as "previous"; marks the user active.
  async rotate(id, newHash) {
    await query(
      `UPDATE user_sessions
       SET previous_token_hash = refresh_token_hash, refresh_token_hash = $2,
           rotated_at = now(), last_activity_at = now()
       WHERE id = $1`,
      [id, newHash]
    );
  },

  async revoke(id) {
    await query(`UPDATE user_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [id]);
  },

  // Ends every session of a user (optionally keeping one, e.g. the current device).
  async revokeAllForUser(userId, exceptId = null) {
    await query(
      `UPDATE user_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2::uuid)`,
      [userId, exceptId]
    );
  },
};

module.exports = SessionModel;
