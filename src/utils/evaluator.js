// ─── Rule-Based Evaluator ─────────────────────────────────────────────────────
// Implements the algorithm described in the MockBot documentation:
//   1. Retrieve expected concepts from the question rubric.
//   2. Compare user responses against the expected concepts.
//   3. Calculate a score based on matched concepts.
//   4. Identify missing concepts.
//   5. Generate feedback for the user.
//
// This module runs entirely offline — no AI API required.
// The AI-powered evaluator (Claude) is an optional enhancement called from
// the answer route when ANTHROPIC_API_KEY is set.

const { query } = require('../config/db');

/**
 * Evaluate an answer against a question's rubric.
 *
 * @param {number} questionId  Database ID of the question
 * @param {string} answerText  The candidate's written answer
 * @returns {Promise<EvaluationResult>}
 *
 * @typedef {Object} EvaluationResult
 * @property {number}   score           0–10
 * @property {string}   verdict         'Strong' | 'Adequate' | 'Needs Work'
 * @property {string[]} strengths       Criteria the answer covered
 * @property {string[]} missed          Criteria not covered
 * @property {string[]} improvements    Actionable suggestions
 * @property {Object}   logic_check     { passed: string[], failed: string[] }
 * @property {string}   overall_feedback  1–2 sentence summary
 */
async function evaluateAnswer(questionId, answerText) {
  // Fetch rubric criteria for this question
  const { rows: criteria } = await query(
    `SELECT criterion, keywords, weight, order_index
     FROM rubrics
     WHERE question_id = $1
     ORDER BY order_index ASC`,
    [questionId]
  );

  if (criteria.length === 0) {
    // No rubric stored — return a neutral placeholder
    return buildResult({ criteria: [], covered: [], totalWeight: 0, coveredWeight: 0, answerText });
  }

  const lower = answerText.toLowerCase();
  const covered   = [];
  const notCovered = [];

  for (const row of criteria) {
    const keywords = Array.isArray(row.keywords) ? row.keywords : [];
    const hit = keywords.length > 0
      ? keywords.some((kw) => lower.includes(kw.toLowerCase()))
      : false;

    if (hit) {
      covered.push(row);
    } else {
      notCovered.push(row);
    }
  }

  const totalWeight   = criteria.reduce((sum, r) => sum + Number(r.weight), 0);
  const coveredWeight = covered.reduce((sum, r) => sum + Number(r.weight), 0);

  return buildResult({ criteria, covered, notCovered, totalWeight, coveredWeight, answerText });
}

// ─── Internal builder ────────────────────────────────────────────────────────
function buildResult({ criteria, covered, notCovered = [], totalWeight, coveredWeight, answerText }) {
  const ratio = totalWeight > 0 ? coveredWeight / totalWeight : 0;
  const score  = Math.round(ratio * 10 * 10) / 10; // 0.0–10.0, 1 decimal

  const verdict = score >= 8 ? 'Strong' : score >= 5 ? 'Adequate' : 'Needs Work';

  const strengths    = covered.map((r)    => r.criterion);
  const missed       = (notCovered || []).map((r) => r.criterion);

  const improvements = buildImprovements(missed, score);

  const logic_check = {
    passed: covered.map((r)    => r.criterion),
    failed: (notCovered || []).map((r) => r.criterion),
  };

  const overall_feedback = buildSummary(score, verdict, strengths.length, missed.length, criteria.length);

  return { score, verdict, strengths, missed, improvements, logic_check, overall_feedback };
}

function buildImprovements(missed, score) {
  const tips = [];

  if (missed.length > 0) {
    tips.push(`Make sure to address: ${missed.slice(0, 2).join(' and ')}.`);
  }
  if (score < 5) {
    tips.push('Structure your answer more clearly — cover the core concept first, then give a concrete example.');
  }
  if (score >= 5 && score < 8) {
    tips.push('Good foundation. Add more depth by discussing trade-offs or edge cases.');
  }
  if (score >= 8) {
    tips.push('Strong answer. Consider mentioning real-world experience to make it more memorable.');
  }

  return tips;
}

function buildSummary(score, verdict, coveredCount, missedCount, total) {
  if (verdict === 'Strong') {
    return `Excellent response — you covered ${coveredCount} of ${total} key criteria. This would impress most interviewers.`;
  }
  if (verdict === 'Adequate') {
    return `Solid attempt covering ${coveredCount} of ${total} criteria. ${missedCount} point${missedCount > 1 ? 's' : ''} were missing — review the "What You Missed" section to sharpen your answer.`;
  }
  return `Your answer covered ${coveredCount} of ${total} criteria. Significant gaps remain — focus on the missed concepts before your next attempt.`;
}

module.exports = { evaluateAnswer };
