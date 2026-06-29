const { query } = require('../config/db');

const AnswerModel = {
  async upsert({
    sessionId, questionId, userId, answerText,
    score, verdict, strengths, missed, improvements, logic_check, overall_feedback,
  }) {
    const { rows } = await query(
      `INSERT INTO answers
         (session_id, question_id, user_id, answer_text,
          score, verdict, strengths, missed, improvements, logic_check, overall_feedback)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (session_id, question_id)
       DO UPDATE SET
         answer_text      = EXCLUDED.answer_text,
         score            = EXCLUDED.score,
         verdict          = EXCLUDED.verdict,
         strengths        = EXCLUDED.strengths,
         missed           = EXCLUDED.missed,
         improvements     = EXCLUDED.improvements,
         logic_check      = EXCLUDED.logic_check,
         overall_feedback = EXCLUDED.overall_feedback,
         submitted_at     = NOW()
       RETURNING *`,
      [
        sessionId, questionId, userId, answerText,
        score, verdict,
        JSON.stringify(strengths || []),
        JSON.stringify(missed    || []),
        JSON.stringify(improvements || []),
        JSON.stringify(logic_check  || {}),
        overall_feedback,
      ]
    );
    return rows[0];
  },

  async findBySession(sessionId, userId) {
    const { rows } = await query(
      `SELECT a.*, q.text AS question_text, q.type, q.category
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       WHERE a.session_id = $1 AND a.user_id = $2
       ORDER BY a.submitted_at ASC`,
      [sessionId, userId]
    );
    return rows;
  },

  // Performance history across all sessions
  async getHistory(userId, limit = 20) {
    const { rows } = await query(
      `SELECT
         a.id, a.score, a.verdict, a.submitted_at,
         q.text AS question_text, q.type, q.category,
         s.session_type, s.started_at
       FROM answers a
       JOIN questions          q ON q.id = a.question_id
       JOIN interview_sessions s ON s.id = a.session_id
       WHERE a.user_id = $1
       ORDER BY a.submitted_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  },

  // Aggregate stats for the user dashboard
  async getStats(userId) {
    const { rows } = await query(
      `SELECT
         COUNT(*)::int                                AS total_answers,
         ROUND(AVG(score)::numeric, 2)               AS average_score,
         COUNT(CASE WHEN verdict = 'Strong'     THEN 1 END)::int AS strong_count,
         COUNT(CASE WHEN verdict = 'Adequate'   THEN 1 END)::int AS adequate_count,
         COUNT(CASE WHEN verdict = 'Needs Work' THEN 1 END)::int AS needs_work_count
       FROM answers
       WHERE user_id = $1`,
      [userId]
    );
    return rows[0];
  },
};

module.exports = AnswerModel;
