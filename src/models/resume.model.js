const { query } = require('../config/db');

const ResumeModel = {
  async create({ userId, filename, filePath, rawText, parsedSkills }) {
    const { rows } = await query(
      `INSERT INTO resumes (user_id, filename, file_path, raw_text, parsed_skills)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, filename, filePath, rawText, JSON.stringify(parsedSkills || [])]
    );
    return rows[0];
  },

  async findAllByUser(userId) {
    const { rows } = await query(
      `SELECT id, user_id, filename, parsed_skills, uploaded_at
       FROM resumes
       WHERE user_id = $1
       ORDER BY uploaded_at DESC`,
      [userId]
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await query(
      `SELECT * FROM resumes WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rows } = await query(
      `DELETE FROM resumes WHERE id = $1 AND user_id = $2 RETURNING id, filename`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async updateParsedSkills(id, parsedSkills) {
    const { rows } = await query(
      `UPDATE resumes SET parsed_skills = $2 WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(parsedSkills)]
    );
    return rows[0];
  },
};

module.exports = ResumeModel;
