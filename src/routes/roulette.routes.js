const express = require('express');
const { authenticate }                      = require('../middleware/auth');
const RouletteModel                         = require('../models/roulette.model');
const { generateRouletteQuestions }         = require('../utils/questiongenerator');

const router = express.Router();
router.use(authenticate);

// ─── POST /api/roulette/join ──────────────────────────────────────────────────
// Body: { preferredRole: 'interviewer' | 'interviewee' | 'any' }
router.post('/join', async (req, res, next) => {
  const preferredRole = req.body?.preferredRole || 'any';

  if (!['interviewer', 'interviewee', 'any'].includes(preferredRole)) {
    return res.status(400).json({ error: 'preferredRole must be interviewer, interviewee, or any.' });
  }

  try {
    const result = await RouletteModel.joinPool(req.userId, preferredRole);

    // If matched, generate AI questions and store them before responding
    if (result.status === 'matched') {
      try {
        const questions = await generateRouletteQuestions(result.match.total_rounds);
        await RouletteModel.saveRounds(result.match.id, questions);
        // Refresh match so it includes status:'active'
        result.match = await RouletteModel.findMatchById(result.match.id);
      } catch (genErr) {
        console.error('Question generation failed:', genErr.message);
        // Still respond — opponent can see status 'generating' and we fail gracefully
      }
    }

    return res.status(result.status === 'matched' ? 200 : 202).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/roulette/leave ───────────────────────────────────────────────
router.delete('/leave', async (req, res, next) => {
  try {
    await RouletteModel.leavePool(req.userId);
    return res.json({ message: 'Left the pool.' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/roulette/match ──────────────────────────────────────────────────
// Poll endpoint — called every 3s while waiting
router.get('/match', async (req, res, next) => {
  try {
    const match = await RouletteModel.checkMatch(req.userId);
    if (!match) {
      const poolSize = await RouletteModel.getPoolSize();
      return res.json({ status: 'waiting', poolSize });
    }
    return res.json({ status: match.status, match });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/roulette/matches/:id ───────────────────────────────────────────
// Full match with all rounds — used to sync both players
router.get('/matches/:id', async (req, res, next) => {
  try {
    const match = await RouletteModel.findMatchById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found.' });

    if (match.user_id_a !== req.userId && match.user_id_b !== req.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    match.role         = match.user_id_a === req.userId ? match.role_a : match.role_b;
    match.partner_name = match.user_id_a === req.userId ? match.user_b_name : match.user_a_name;

    return res.json({ match });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/roulette/matches/:id/rounds/:roundNum/submit ──────────────────
// Interviewee submits their answer for a round
router.post('/matches/:id/rounds/:roundNum/submit', async (req, res, next) => {
  const matchId    = Number(req.params.id);
  const roundNum   = Number(req.params.roundNum);
  const { answerText } = req.body;

  if (!answerText || answerText.trim().length < 5) {
    return res.status(400).json({ error: 'Answer text is required.' });
  }

  try {
    const match = await RouletteModel.findMatchById(matchId);
    if (!match) return res.status(404).json({ error: 'Match not found.' });

    // Only the interviewee can submit answers
    const myRole = match.user_id_a === req.userId ? match.role_a : match.role_b;
    if (myRole !== 'interviewee') {
      return res.status(403).json({ error: 'Only the interviewee can submit answers.' });
    }
    if (match.status !== 'active') {
      return res.status(409).json({ error: 'This match is not active.' });
    }
    if (roundNum !== match.current_round) {
      return res.status(409).json({ error: `Expected round ${match.current_round}, got ${roundNum}.` });
    }

    // Find the round's question
    const round = match.rounds.find(r => r.round_number === roundNum);
    if (!round) return res.status(404).json({ error: 'Round not found.' });

    // Evaluate with Gemini
    const evaluation = await evaluateWithGemini(round.question_text, round.question_type, answerText);

    // Save answer + evaluation
    const savedRound = await RouletteModel.submitRound(matchId, roundNum, answerText, evaluation);

    return res.json({
      message:   'Answer submitted.',
      round:     savedRound,
      evaluation,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/roulette/matches/:id/advance ─────────────────────────────────
// Interviewer advances to the next round after seeing the result
router.patch('/matches/:id/advance', async (req, res, next) => {
  const matchId = Number(req.params.id);

  try {
    const match = await RouletteModel.findMatchById(matchId);
    if (!match) return res.status(404).json({ error: 'Match not found.' });

    const myRole = match.user_id_a === req.userId ? match.role_a : match.role_b;
    if (myRole !== 'interviewer') {
      return res.status(403).json({ error: 'Only the interviewer can advance rounds.' });
    }
    if (match.status !== 'active') {
      return res.status(409).json({ error: 'Match is not active.' });
    }

    // Make sure current round has been answered before advancing
    const currentRound = match.rounds.find(r => r.round_number === match.current_round);
    if (!currentRound?.submitted_at) {
      return res.status(409).json({ error: 'Wait for the interviewee to answer before advancing.' });
    }

    const updated = await RouletteModel.advanceRound(matchId, match.current_round, match.total_rounds);
    return res.json({ message: 'Round advanced.', match: updated });
  } catch (err) {
    next(err);
  }
});

// ─── Gemini evaluator (no rubric — open-ended evaluation) ────────────────────
async function evaluateWithGemini(questionText, questionType, answerText) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackEvaluation(answerText);
  }

  const prompt = `You are MockBot, a technical interview evaluator conducting a peer mock interview.
Evaluate the candidate's answer and respond ONLY with valid JSON (no markdown):
{"score":7,"verdict":"Adequate","strengths":["specific strength"],"missed":["specific gap"],"improvements":["actionable tip"],"overall_feedback":"2-3 sentence summary an interviewer would give."}
Verdicts: "Strong" (8-10), "Adequate" (5-7), "Needs Work" (0-4)

QUESTION TYPE: ${questionType}
QUESTION: ${questionText}
CANDIDATE ANSWER: ${answerText}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
      }),
    });

    const data  = await response.json();
    const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return fallbackEvaluation(answerText);
  }
}

function fallbackEvaluation(answerText) {
  const wordCount = answerText.trim().split(/\s+/).length;
  const score     = wordCount > 80 ? 6 : wordCount > 40 ? 4 : 2;
  const verdict   = score >= 6 ? 'Adequate' : 'Needs Work';
  return {
    score,
    verdict,
    strengths:        wordCount > 40 ? ['Provided a substantive response'] : [],
    missed:           ['AI evaluation unavailable — detailed feedback not generated'],
    improvements:     ['Set GEMINI_API_KEY to enable AI-powered feedback'],
    overall_feedback: `Answer contains ${wordCount} words. AI evaluation is unavailable; set GEMINI_API_KEY for detailed feedback.`,
  };
}

module.exports = router;
