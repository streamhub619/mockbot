const express = require('express');
const { body, validationResult } = require('express-validator');

const { authenticate }    = require('../middleware/auth');
const AnswerModel         = require('../models/answer.model');
const { evaluateAnswer }  = require('../utils/evaluator');
const { query }           = require('../config/db');

const router = express.Router();
router.use(authenticate);

// POST /api/answers
// Submits an answer, runs evaluation (rule-based, or AI if key is set), and stores results.
router.post(
  '/',
  [
    body('sessionId').isInt({ min: 1 }).withMessage('sessionId must be a positive integer.'),
    body('questionId').isInt({ min: 1 }).withMessage('questionId must be a positive integer.'),
    body('answerText').trim().isLength({ min: 10 })
      .withMessage('Answer must be at least 10 characters.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { sessionId, questionId, answerText } = req.body;

    try {
      // Verify the session belongs to this user and is still active
      const { rows: [session] } = await query(
        `SELECT id, status FROM interview_sessions WHERE id = $1 AND user_id = $2`,
        [sessionId, req.userId]
      );

      if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
      }
      if (session.status !== 'active') {
        return res.status(409).json({ error: 'This session is no longer active.' });
      }

      // Verify the question belongs to this session
      const { rows: [sq] } = await query(
        `SELECT id FROM session_questions WHERE session_id = $1 AND question_id = $2`,
        [sessionId, questionId]
      );

      if (!sq) {
        return res.status(400).json({ error: 'This question is not part of the session.' });
      }

      // Evaluate
      let evaluation;

      if (process.env.ANTHROPIC_API_KEY) {
        // Optional AI path (Sprint 4+)
        evaluation = await evaluateWithAI(questionId, answerText);
      } else {
        // Default: rule-based offline evaluation
        evaluation = await evaluateAnswer(questionId, answerText);
      }

      // Persist
      const answer = await AnswerModel.upsert({
        sessionId,
        questionId,
        userId:   req.userId,
        answerText,
        ...evaluation,
      });

      return res.status(201).json({
        message: 'Answer submitted and evaluated.',
        answer: {
          id:              answer.id,
          score:           answer.score,
          verdict:         answer.verdict,
          strengths:       answer.strengths,
          missed:          answer.missed,
          improvements:    answer.improvements,
          logic_check:     answer.logic_check,
          overall_feedback: answer.overall_feedback,
          submittedAt:     answer.submitted_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/answers/session/:sessionId  — all answers for a session
router.get('/session/:sessionId', async (req, res, next) => {
  try {
    const answers = await AnswerModel.findBySession(req.params.sessionId, req.userId);
    return res.json({ answers });
  } catch (err) {
    next(err);
  }
});

// GET /api/answers/history  — recent answer history
router.get('/history', async (req, res, next) => {
  try {
    const limit   = Math.min(Number(req.query.limit) || 20, 100);
    const history = await AnswerModel.getHistory(req.userId, limit);
    return res.json({ history });
  } catch (err) {
    next(err);
  }
});

// Optional AI Evaluator (Sprint 4)
async function evaluateWithAI(questionId, answerText) {
  const { rows: [question] } = await query(
    `SELECT text, type, category, hint FROM questions WHERE id = $1`,
    [questionId]
  );
  const { rows: rubric } = await query(
    `SELECT criterion, keywords FROM rubrics WHERE question_id = $1 ORDER BY order_index`,
    [questionId]
  );

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: `You are MockBot, a rigorous technical interview evaluator.
Evaluate the candidate's answer and respond ONLY with valid JSON (no markdown):
{"score":7,"verdict":"Adequate","strengths":["..."],"missed":["..."],"improvements":["..."],"logic_check":{"passed":["..."],"failed":["..."]},"overall_feedback":"2-3 sentence summary."}
Verdicts: "Strong" (8-10), "Adequate" (5-7), "Needs Work" (0-4)`,
      messages: [{
        role: 'user',
        content: `QUESTION (${question?.type} - ${question?.category}): ${question?.text}
EXPECTED CONCEPTS: ${question?.hint}
RUBRIC: ${rubric.map((r) => r.criterion).join('; ')}
CANDIDATE ANSWER: ${answerText}`,
      }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  try {
    return JSON.parse(text);
  } catch {
    // AI response unparseable — fall back to rule-based
    const { evaluateAnswer } = require('../utils/evaluator');
    return evaluateAnswer(questionId, answerText);
  }
}

module.exports = router;
