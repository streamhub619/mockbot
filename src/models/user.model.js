const { query } = require('../config/db');

const UserModel = {
  async create({ fullName, email, passwordHash }) {
    const { rows } = await query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, created_at`,
      [fullName, email, passwordHash]
    );
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await query(
      `SELECT id, full_name, email, password_hash, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT id, full_name, email, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async update(id, { fullName, email }) {
    const { rows } = await query(
      `UPDATE users
       SET full_name = COALESCE($2, full_name),
           email     = COALESCE($3, email)
       WHERE id = $1
       RETURNING id, full_name, email, updated_at`,
      [id, fullName, email]
    );
    return rows[0] || null;
  },
};

module.exports = UserModel;
