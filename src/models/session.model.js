const { query, withTransaction } = require('../config/db');

const SessionModel = {
  // Create a new session and assign its questions in one transaction
  async create({ userId, resumeId, jobDescriptionId, sessionType, questionIds }) {
    return withTransaction(async (client) => {
      const { rows: [session] } = await client.query(
        `INSERT INTO interview_sessions
           (user_id, resume_id, job_description_id, session_type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, resumeId || null, jobDescriptionId || null, sessionType]
      );

      if (questionIds && questionIds.length > 0) {
        const values = questionIds
          .map((qId, i) => `($1, ${qId}, ${i + 1})`)
          .join(', ');
        await client.query(
          `INSERT INTO session_questions (session_id, question_id, order_index)
           VALUES ${values}`,
          [session.id]
        );
      }

      return session;
    });
  },

  async findAllByUser(userId) {
    const { rows } = await query(
      `SELECT
         s.id, s.session_type, s.status, s.total_score,
         s.started_at, s.completed_at,
         r.filename   AS resume_filename,
         jd.title     AS jd_title,
         jd.company   AS jd_company,
         COUNT(sq.id) AS question_count
       FROM interview_sessions s
       LEFT JOIN resumes           r  ON r.id  = s.resume_id
       LEFT JOIN job_descriptions  jd ON jd.id = s.job_description_id
       LEFT JOIN session_questions sq ON sq.session_id = s.id
       WHERE s.user_id = $1
       GROUP BY s.id, r.filename, jd.title, jd.company
       ORDER BY s.started_at DESC`,
      [userId]
    );
    return rows;
  },

  // Full session with ordered questions and submitted answers
  async findById(sessionId, userId) {
    const { rows: [session] } = await query(
      `SELECT s.*, jd.title AS jd_title, jd.company AS jd_company
       FROM interview_sessions s
       LEFT JOIN job_descriptions jd ON jd.id = s.job_description_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [sessionId, userId]
    );
    if (!session) return null;

    const { rows: questions } = await query(
      `SELECT q.id, q.text, q.type, q.category, q.difficulty, q.hint,
              sq.order_index
       FROM session_questions sq
       JOIN questions q ON q.id = sq.question_id
       WHERE sq.session_id = $1
       ORDER BY sq.order_index ASC`,
      [sessionId]
    );

    const { rows: answers } = await query(
      `SELECT question_id, score, verdict, strengths, missed,
              improvements, logic_check, overall_feedback, submitted_at
       FROM answers
       WHERE session_id = $1`,
      [sessionId]
    );

    session.questions = questions;
    session.answers   = answers;
    return session;
  },

  async complete(sessionId, userId) {
    // Calculate average score from all answers in the session
    const { rows } = await query(
      `UPDATE interview_sessions
       SET status       = 'completed',
           completed_at = NOW(),
           total_score  = (
             SELECT ROUND(AVG(score)::numeric, 2)
             FROM answers
             WHERE session_id = $1
           )
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING *`,
      [sessionId, userId]
    );
    return rows[0] || null;
  },

  async abandon(sessionId, userId) {
    const { rows } = await query(
      `UPDATE interview_sessions
       SET status = 'abandoned', completed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING id, status`,
      [sessionId, userId]
    );
    return rows[0] || null;
  },

  // Return seeded generic questions for a quick session
  async getGenericQuestions(limit = 7) {
    const { rows } = await query(
      `SELECT id, text, type, category, difficulty, hint
       FROM questions
       WHERE is_generic = TRUE
       ORDER BY RANDOM()
       LIMIT $1`,
      [limit]
    );
    return rows;
  },
};

module.exports = SessionModel;
