const { query } = require('../config/db');

const JobDescriptionModel = {
  async create({ userId, title, company, descriptionText, requiredSkills }) {
    const { rows } = await query(
      `INSERT INTO job_descriptions (user_id, title, company, description_text, required_skills)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, title, company, descriptionText, JSON.stringify(requiredSkills || [])]
    );
    return rows[0];
  },

  async findAllByUser(userId) {
    const { rows } = await query(
      `SELECT id, user_id, title, company, required_skills, created_at
       FROM job_descriptions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await query(
      `SELECT * FROM job_descriptions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rows } = await query(
      `DELETE FROM job_descriptions WHERE id = $1 AND user_id = $2 RETURNING id, title`,
      [id, userId]
    );
    return rows[0] || null;
  },
};

module.exports = JobDescriptionModel;
