const express = require('express');

const { authenticate }  = require('../middleware/auth');
const RouletteModel     = require('../models/roulette.model');
const AnswerModel       = require('../models/answer.model');
const { evaluateAnswer } = require('../utils/evaluator');

const router = express.Router();
router.use(authenticate);

// POST /api/roulette/join
// Adds the user to the waiting pool and attempts to match them immediately.
// Response tells the caller whether they are 'waiting' or 'matched'.
router.post('/join', async (req, res, next) => {
  try {
    const result = await RouletteModel.joinPool(req.userId);
    return res.status(result.status === 'matched' ? 200 : 202).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/roulette/leave
// Removes the user from the waiting pool (e.g. they navigated away).
router.delete('/leave', async (req, res, next) => {
  try {
    await RouletteModel.leavePool(req.userId);
    return res.json({ message: 'Left the pool.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/roulette/match
// Polls for an active match. Frontend polls this every 3 s while status === 'waiting'.
router.get('/match', async (req, res, next) => {
  try {
    const match = await RouletteModel.checkMatch(req.userId);
    if (!match) {
      const poolSize = await RouletteModel.getPoolSize();
      return res.json({ status: 'waiting', poolSize });
    }
    return res.json({ status: 'matched', match });
  } catch (err) {
    next(err);
  }
});

// GET /api/roulette/matches/:id
// Full match details — question + rubric. The rubric is always returned;
// the FRONTEND hides it from the interviewee until submission.
router.get('/matches/:id', async (req, res, next) => {
  try {
    const match = await RouletteModel.findMatchById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found.' });

    // Ensure the requesting user is a participant
    if (match.user_id_a !== req.userId && match.user_id_b !== req.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    match.role = match.user_id_a === req.userId ? 'interviewer' : 'interviewee';
    return res.json({ match });
  } catch (err) {
    next(err);
  }
});

// POST /api/roulette/matches/:id/submit
// The interviewee submits their answer. Evaluation runs, match completes.
router.post('/matches/:id/submit', async (req, res, next) => {
  const { answerText } = req.body;

  if (!answerText || answerText.trim().length < 5) {
    return res.status(400).json({ error: 'Answer text is required.' });
  }

  try {
    const match = await RouletteModel.findMatchById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found.' });

    // Only the interviewee (user_b) can submit
    if (match.user_id_b !== req.userId) {
      return res.status(403).json({ error: 'Only the interviewee can submit an answer.' });
    }

    if (match.status !== 'active') {
      return res.status(409).json({ error: 'This match is no longer active.' });
    }

    // Evaluate the answer
    const evaluation = await evaluateAnswer(match.question_id, answerText);

    // Persist the answer against the interviewee's session
    const answer = await AnswerModel.upsert({
      sessionId:  match.session_id_b,
      questionId: match.question_id,
      userId:     req.userId,
      answerText,
      ...evaluation,
    });

    // Complete the match
    await RouletteModel.completeMatch(match.id);

    return res.json({
      message:    'Answer submitted.',
      answer,
      evaluation,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
