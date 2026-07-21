const { query, withTransaction } = require('../config/db');

// ─── Role assignment logic ────────────────────────────────────────────────────
// userA = the one who was waiting (higher priority in conflicts)
// userB = the one who just joined
function assignRoles(aPref, bPref) {
  if (aPref === 'interviewer' || bPref === 'interviewee') {
    if (aPref !== 'interviewee') return { aRole: 'interviewer', bRole: 'interviewee' };
  }
  if (aPref === 'interviewee' || bPref === 'interviewer') {
    if (aPref !== 'interviewer') return { aRole: 'interviewee', bRole: 'interviewer' };
  }
  // Both 'any' or genuine conflict → longer-waiting user (A) gets interviewer
  return { aRole: 'interviewer', bRole: 'interviewee' };
}

const RouletteModel = {

  // ── Join the waiting pool ──────────────────────────────────────────────────
  async joinPool(userId, preferredRole = 'any') {
    return withTransaction(async (client) => {
      // Create a roulette session for this user
      const { rows: [session] } = await client.query(
        `INSERT INTO interview_sessions (user_id, session_type)
         VALUES ($1, 'roulette') RETURNING id`,
        [userId]
      );

      // Upsert into pool with preferred role
      await client.query(
        `INSERT INTO roulette_pool (user_id, session_id, preferred_role)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           session_id     = EXCLUDED.session_id,
           preferred_role = EXCLUDED.preferred_role,
           joined_at      = NOW()`,
        [userId, session.id, preferredRole]
      );

      // Try to find a waiting opponent (oldest entry, not us)
      const { rows: [opponent] } = await client.query(
        `SELECT user_id, session_id, preferred_role
         FROM roulette_pool
         WHERE user_id != $1
         ORDER BY joined_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [userId]
      );

      if (!opponent) {
        return { status: 'waiting', sessionId: session.id };
      }

      // Assign roles — opponent was waiting (A), current user just joined (B)
      const { aRole, bRole } = assignRoles(opponent.preferred_role, preferredRole);

      // Create match record — status 'generating' until AI questions are ready
      const { rows: [match] } = await client.query(
        `INSERT INTO roulette_matches
           (user_id_a, user_id_b, session_id_a, session_id_b,
            role_a, role_b, status, started_at, total_rounds, current_round)
         VALUES ($1, $2, $3, $4, $5, $6, 'generating', NOW(), 7, 1)
         RETURNING *`,
        [opponent.user_id, userId, opponent.session_id, session.id, aRole, bRole]
      );

      // Remove both users from the pool
      await client.query(
        `DELETE FROM roulette_pool WHERE user_id IN ($1, $2)`,
        [userId, opponent.user_id]
      );

      return {
        status:    'matched',
        match,
        sessionId: session.id,
        role:      bRole,  // current user is user_b
      };
    });
  },

  // ── Store AI-generated questions as rounds ────────────────────────────────
  async saveRounds(matchId, questions) {
    for (const q of questions) {
      await query(
        `INSERT INTO roulette_rounds
           (match_id, round_number, question_text, question_type, question_category)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (match_id, round_number) DO NOTHING`,
        [matchId, q.round_number, q.question_text, q.question_type, q.question_category]
      );
    }
    // Mark match as active now that questions are ready
    await query(
      `UPDATE roulette_matches SET status = 'active' WHERE id = $1`,
      [matchId]
    );
  },

  // ── Leave the pool ────────────────────────────────────────────────────────
  async leavePool(userId) {
    const { rows } = await query(
      `DELETE FROM roulette_pool WHERE user_id = $1 RETURNING id`,
      [userId]
    );
    return rows[0] || null;
  },

  // ── Poll: check if the waiting user has been matched ─────────────────────
  async checkMatch(userId) {
    const { rows: [match] } = await query(
      `SELECT rm.*
       FROM roulette_matches rm
       WHERE (rm.user_id_a = $1 OR rm.user_id_b = $1)
         AND rm.status IN ('generating', 'active', 'completed')
       ORDER BY rm.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (!match) return null;

    match.role = match.user_id_a === userId ? match.role_a : match.role_b;
    return match;
  },

  // ── Get a full match with all rounds ─────────────────────────────────────
  async findMatchById(matchId) {
    const { rows: [match] } = await query(
      `SELECT rm.*,
              ua.full_name AS user_a_name,
              ub.full_name AS user_b_name
       FROM roulette_matches rm
       JOIN users ua ON ua.id = rm.user_id_a
       JOIN users ub ON ub.id = rm.user_id_b
       WHERE rm.id = $1`,
      [matchId]
    );
    if (!match) return null;

    const { rows: rounds } = await query(
      `SELECT * FROM roulette_rounds
       WHERE match_id = $1
       ORDER BY round_number ASC`,
      [matchId]
    );

    match.rounds = rounds;
    return match;
  },

  // ── Submit an answer for a round + store evaluation ───────────────────────
  async submitRound(matchId, roundNumber, answerText, evaluation) {
    const { rows: [round] } = await query(
      `UPDATE roulette_rounds SET
         answer_text      = $3,
         score            = $4,
         verdict          = $5,
         strengths        = $6,
         missed           = $7,
         improvements     = $8,
         overall_feedback = $9,
         submitted_at     = NOW()
       WHERE match_id = $1 AND round_number = $2
       RETURNING *`,
      [
        matchId,
        roundNumber,
        answerText,
        evaluation.score,
        evaluation.verdict,
        JSON.stringify(evaluation.strengths    || []),
        JSON.stringify(evaluation.missed       || []),
        JSON.stringify(evaluation.improvements || []),
        evaluation.overall_feedback || '',
      ]
    );
    return round || null;
  },

  // ── Advance to the next round (called by the interviewer) ─────────────────
  async advanceRound(matchId, currentRound, totalRounds) {
    if (currentRound >= totalRounds) {
      // Last round done — complete the match and both sessions
      const { rows: [match] } = await query(
        `UPDATE roulette_matches
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1 RETURNING *`,
        [matchId]
      );

      // Calculate average score across all rounds and complete both sessions
      await query(
        `UPDATE interview_sessions SET
           status = 'completed',
           completed_at = NOW(),
           total_score = (
             SELECT ROUND(AVG(score)::numeric, 2)
             FROM roulette_rounds
             WHERE match_id = $1 AND score IS NOT NULL
           )
         WHERE id IN (
           SELECT session_id_a FROM roulette_matches WHERE id = $1
           UNION
           SELECT session_id_b FROM roulette_matches WHERE id = $1
         )`,
        [matchId]
      );

      return match;
    }

    // Advance to next round
    const { rows: [match] } = await query(
      `UPDATE roulette_matches SET current_round = current_round + 1
       WHERE id = $1 RETURNING *`,
      [matchId]
    );
    return match;
  },

  async getPoolSize() {
    const { rows } = await query(`SELECT COUNT(*) AS count FROM roulette_pool`);
    return Number(rows[0].count);
  },
};

module.exports = RouletteModel;
