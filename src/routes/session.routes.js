const express = require('express');
const { body, validationResult } = require('express-validator');

const { authenticate }          = require('../middleware/auth');
const SessionModel              = require('../models/session.model');
const ResumeModel               = require('../models/resume.model');
const JobDescriptionModel       = require('../models/jobdescription.model');
const AnswerModel               = require('../models/answer.model');
const { matchSkills }           = require('../utils/skillextractor');
const { generateQuestions }     = require('../utils/questiongenerator');
const { query }                 = require('../config/db');

const router = express.Router();
router.use(authenticate);

// POST /api/sessions
router.post(
  '/',
  [
    body('sessionType')
      .isIn(['resume_tailored', 'ai_tailored', 'quick'])
      .withMessage("sessionType must be 'resume_tailored', 'ai_tailored', or 'quick'."),
    body('resumeId').optional().isInt(),
    body('jobDescriptionId').optional().isInt(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { sessionType, resumeId, jobDescriptionId } = req.body;

    try {
      let questionIds = [];

      if (sessionType === 'ai_tailored') {
        // ── AI MODE ──────────────────────────────────────────
        if (!process.env.GEMINI_API_KEY) {
          return res.status(503).json({
            error: 'AI mode is not available — GEMINI_API_KEY is not configured.',
          });
        }
        if (!resumeId || !jobDescriptionId) {
          return res.status(400).json({
            error: 'resumeId and jobDescriptionId are required for AI sessions.',
          });
        }

        const [resume, jd] = await Promise.all([
          ResumeModel.findById(resumeId, req.userId),
          JobDescriptionModel.findById(jobDescriptionId, req.userId),
        ]);

        if (!resume) return res.status(404).json({ error: 'Resume not found.' });
        if (!jd)     return res.status(404).json({ error: 'Job description not found.' });

        // Gemini generates and persists questions, returns their IDs
        questionIds = await generateQuestions(
          resume.raw_text || '',
          jd.description_text || '',
          5, 2
        );

      } else if (sessionType === 'resume_tailored') {
        // ── RULES MODE ────────────────────────────────────────
        if (!resumeId || !jobDescriptionId) {
          return res.status(400).json({
            error: 'resumeId and jobDescriptionId are required for resume_tailored sessions.',
          });
        }

        const [resume, jd] = await Promise.all([
          ResumeModel.findById(resumeId, req.userId),
          JobDescriptionModel.findById(jobDescriptionId, req.userId),
        ]);

        if (!resume) return res.status(404).json({ error: 'Resume not found.' });
        if (!jd)     return res.status(404).json({ error: 'Job description not found.' });

        const resumeSkillNames = (resume.parsed_skills || []).map((s) => s.name);
        const jdSkillNames     = (jd.required_skills   || []).map((s) => s.name);
        const matched          = matchSkills(resumeSkillNames, jdSkillNames);

        questionIds = await selectTailoredQuestions(matched, 5, 2);

      } else {
        // ── QUICK MODE ────────────────────────────────────────
        const qs = await SessionModel.getGenericQuestions(7);
        questionIds = qs.map((q) => q.id);
      }

      if (questionIds.length === 0) {
        return res.status(422).json({
          error: 'Could not select questions. Ensure your resume and job description have enough detail.',
        });
      }

      const session = await SessionModel.create({
        userId:           req.userId,
        resumeId:         resumeId         || null,
        jobDescriptionId: jobDescriptionId || null,
        sessionType,
        questionIds,
      });

      return res.status(201).json({ message: 'Session created.', session });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sessions
router.get('/', async (req, res, next) => {
  try {
    const sessions = await SessionModel.findAllByUser(req.userId);
    return res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/history/stats — MUST be before /:id
router.get('/history/stats', async (req, res, next) => {
  try {
    const stats   = await AnswerModel.getStats(req.userId);
    const history = await AnswerModel.getHistory(req.userId, 10);
    return res.json({ stats, recentAnswers: history });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const session = await SessionModel.findById(req.params.id, req.userId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    return res.json({ session });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sessions/:id/complete
router.patch('/:id/complete', async (req, res, next) => {
  try {
    const session = await SessionModel.complete(req.params.id, req.userId);
    if (!session) return res.status(404).json({ error: 'Session not found or already closed.' });
    return res.json({ message: 'Session completed.', session });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sessions/:id/abandon
router.patch('/:id/abandon', async (req, res, next) => {
  try {
    const session = await SessionModel.abandon(req.params.id, req.userId);
    if (!session) return res.status(404).json({ error: 'Session not found or already closed.' });
    return res.json({ message: 'Session abandoned.', session });
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function selectTailoredQuestions(matchedSkills, techCount, behavCount) {
  const lowerMatched = matchedSkills.map((s) => s.toLowerCase());

  const { rows: techQuestions } = await query(
    `SELECT id, category FROM questions
     WHERE is_generic = TRUE AND type = 'technical'
     ORDER BY RANDOM()`
  );

  const scored = techQuestions.map((q) => {
    const catLower = (q.category || '').toLowerCase();
    const score    = lowerMatched.filter((s) => catLower.includes(s) || s.includes(catLower)).length;
    return { ...q, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const techIds = scored.slice(0, techCount).map((q) => q.id);

  const { rows: behavQuestions } = await query(
    `SELECT id FROM questions
     WHERE is_generic = TRUE AND type = 'behavioral'
     ORDER BY RANDOM()
     LIMIT $1`,
    [behavCount]
  );
  const behavIds = behavQuestions.map((q) => q.id);

  return [...techIds, ...behavIds];
}

module.exports = router;
