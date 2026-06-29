const { query, withTransaction } = require('../config/db');

const RouletteModel = {
  // Add a user to the waiting pool. Creates their roulette session too.
  async joinPool(userId) {
    return withTransaction(async (client) => {
      // Create a roulette session for this user
      const { rows: [session] } = await client.query(
        `INSERT INTO interview_sessions (user_id, session_type)
         VALUES ($1, 'roulette')
         RETURNING id`,
        [userId]
      );

      // Upsert into pool (a user can only have one pool entry at a time)
      await client.query(
        `INSERT INTO roulette_pool (user_id, session_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET session_id = EXCLUDED.session_id, joined_at = NOW()`,
        [userId, session.id]
      );

      // Try to find a waiting opponent (oldest entry, not us)
      const { rows: [opponent] } = await client.query(
        `SELECT rp.user_id, rp.session_id
         FROM roulette_pool rp
         WHERE rp.user_id != $1
         ORDER BY rp.joined_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [userId]
      );

      if (!opponent) {
        // No one waiting — stay in pool
        return { status: 'waiting', sessionId: session.id };
      }

      // Pick a random generic question for the match
      const { rows: [question] } = await client.query(
        `SELECT id FROM questions WHERE is_generic = TRUE ORDER BY RANDOM() LIMIT 1`
      );

      // Create the match record
      const { rows: [match] } = await client.query(
        `INSERT INTO roulette_matches
           (user_id_a, user_id_b, session_id_a, session_id_b, question_id, status, started_at)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW())
         RETURNING *`,
        [opponent.user_id, userId, opponent.session_id, session.id, question?.id || null]
      );

      // Remove both users from pool
      await client.query(
        `DELETE FROM roulette_pool WHERE user_id IN ($1, $2)`,
        [userId, opponent.user_id]
      );

      return { status: 'matched', match, sessionId: session.id, role: 'interviewee' };
    });
  },

  async leavePool(userId) {
    const { rows } = await query(
      `DELETE FROM roulette_pool WHERE user_id = $1 RETURNING id`,
      [userId]
    );
    return rows[0] || null;
  },

  // Poll for a match (called by the user who is still waiting)
  async checkMatch(userId) {
    const { rows: [match] } = await query(
      `SELECT rm.*, q.text AS question_text, q.category, q.difficulty, q.hint
       FROM roulette_matches rm
       LEFT JOIN questions q ON q.id = rm.question_id
       WHERE (rm.user_id_a = $1 OR rm.user_id_b = $1)
         AND rm.status IN ('active', 'waiting')
       ORDER BY rm.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (!match) return null;

    match.role = match.user_id_a === userId ? 'interviewer' : 'interviewee';
    return match;
  },

  async findMatchById(matchId) {
    const { rows: [match] } = await query(
      `SELECT rm.*,
              q.text AS question_text, q.category, q.difficulty, q.hint,
              ua.full_name AS interviewer_name,
              ub.full_name AS interviewee_name
       FROM roulette_matches rm
       LEFT JOIN questions q  ON q.id  = rm.question_id
       LEFT JOIN users     ua ON ua.id = rm.user_id_a
       LEFT JOIN users     ub ON ub.id = rm.user_id_b
       WHERE rm.id = $1`,
      [matchId]
    );

    if (!match) return null;

    // Fetch rubric for the question
    if (match.question_id) {
      const { rows: rubric } = await query(
        `SELECT criterion, keywords, order_index
         FROM rubrics
         WHERE question_id = $1
         ORDER BY order_index ASC`,
        [match.question_id]
      );
      match.rubric = rubric;
    }

    return match;
  },

  async completeMatch(matchId) {
    const { rows } = await query(
      `UPDATE roulette_matches
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [matchId]
    );
    return rows[0] || null;
  },

  async getPoolSize() {
    const { rows } = await query(`SELECT COUNT(*) AS count FROM roulette_pool`);
    return Number(rows[0].count);
  },
};

module.exports = RouletteModel;
