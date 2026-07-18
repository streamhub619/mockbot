const express = require('express');
const { body, validationResult } = require('express-validator');

const { authenticate }   = require('../middleware/auth');
const AnswerModel        = require('../models/answer.model');
const { evaluateAnswer } = require('../utils/evaluator');
const { query }          = require('../config/db');

const router = express.Router();
router.use(authenticate);

// POST /api/answers
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
      // Fetch session — include session_type to decide which evaluator to use
      const { rows: [session] } = await query(
        `SELECT id, status, session_type
         FROM interview_sessions
         WHERE id = $1 AND user_id = $2`,
        [sessionId, req.userId]
      );

      if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
      }
      if (session.status !== 'active') {
        return res.status(409).json({ error: 'This session is no longer active.' });
      }

      const { rows: [sq] } = await query(
        `SELECT id FROM session_questions
         WHERE session_id = $1 AND question_id = $2`,
        [sessionId, questionId]
      );

      if (!sq) {
        return res.status(400).json({ error: 'This question is not part of the session.' });
      }

      // ── Route to the right evaluator based on session type ──
      // ai_tailored  → Gemini evaluation
      // everything else → rule-based rubric evaluator
      let evaluation;
      if (session.session_type === 'ai_tailored' && process.env.GEMINI_API_KEY) {
        evaluation = await evaluateWithGemini(questionId, answerText);
      } else {
        evaluation = await evaluateAnswer(questionId, answerText);
      }

      const answer = await AnswerModel.upsert({
        sessionId,
        questionId,
        userId: req.userId,
        answerText,
        ...evaluation,
      });

      return res.status(201).json({
        message: 'Answer submitted and evaluated.',
        answer: {
          id:               answer.id,
          score:            answer.score,
          verdict:          answer.verdict,
          strengths:        answer.strengths,
          missed:           answer.missed,
          improvements:     answer.improvements,
          logic_check:      answer.logic_check,
          overall_feedback: answer.overall_feedback,
          submittedAt:      answer.submitted_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/answers/session/:sessionId
router.get('/session/:sessionId', async (req, res, next) => {
  try {
    const answers = await AnswerModel.findBySession(req.params.sessionId, req.userId);
    return res.json({ answers });
  } catch (err) {
    next(err);
  }
});

// GET /api/answers/history
router.get('/history', async (req, res, next) => {
  try {
    const limit   = Math.min(Number(req.query.limit) || 20, 100);
    const history = await AnswerModel.getHistory(req.userId, limit);
    return res.json({ history });
  } catch (err) {
    next(err);
  }
});

// ─── Gemini Evaluator ─────────────────────────────────────────────────────────
async function evaluateWithGemini(questionId, answerText) {
  const { rows: [question] } = await query(
    `SELECT text, type, category, hint FROM questions WHERE id = $1`,
    [questionId]
  );

  const prompt = `You are MockBot, a rigorous technical interview evaluator.
Evaluate the candidate's answer and respond ONLY with valid JSON (no markdown, no code fences):
{"score":7,"verdict":"Adequate","strengths":["..."],"missed":["..."],"improvements":["..."],"logic_check":{"passed":["..."],"failed":["..."]},"overall_feedback":"2-3 sentence summary."}
Verdicts: "Strong" (8-10), "Adequate" (5-7), "Needs Work" (0-4)

QUESTION (${question?.type} - ${question?.category}): ${question?.text}
EXPECTED CONCEPTS: ${question?.hint}
CANDIDATE ANSWER: ${answerText}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.2,
        maxOutputTokens: 1200,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Gemini evaluation error:', data);
    return evaluateAnswer(questionId, answerText);
  }

  const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = raw.replace(/```json\n?|```\n?/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    console.warn('Gemini evaluation response not valid JSON — falling back to rule-based.');
    return evaluateAnswer(questionId, answerText);
  }
}

module.exports = router;
