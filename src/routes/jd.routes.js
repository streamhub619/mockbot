const express = require('express');
const { body, validationResult } = require('express-validator');

const { authenticate }      = require('../middleware/auth');
const JobDescriptionModel   = require('../models/jobdescription.model');
const { extractSkills }     = require('../utils/skillextractor');

const router = express.Router();
router.use(authenticate);

// POST /api/job-descriptions
router.post(
  '/',
  [
    body('descriptionText').trim().isLength({ min: 50 })
      .withMessage('Job description must be at least 50 characters.'),
    body('title').optional().trim(),
    body('company').optional().trim(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { title, company, descriptionText } = req.body;
      const requiredSkills = extractSkills(descriptionText);

      const jd = await JobDescriptionModel.create({
        userId: req.userId,
        title:  title   || null,
        company: company || null,
        descriptionText,
        requiredSkills,
      });

      return res.status(201).json({
        message: 'Job description saved.',
        jobDescription: {
          id:             jd.id,
          title:          jd.title,
          company:        jd.company,
          requiredSkills: jd.required_skills,
          createdAt:      jd.created_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/job-descriptions
router.get('/', async (req, res, next) => {
  try {
    const jds = await JobDescriptionModel.findAllByUser(req.userId);
    return res.json({ jobDescriptions: jds });
  } catch (err) {
    next(err);
  }
});

// GET /api/job-descriptions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const jd = await JobDescriptionModel.findById(req.params.id, req.userId);
    if (!jd) return res.status(404).json({ error: 'Job description not found.' });
    return res.json({ jobDescription: jd });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/job-descriptions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await JobDescriptionModel.delete(req.params.id, req.userId);
    if (!deleted) return res.status(404).json({ error: 'Job description not found.' });
    return res.json({ message: 'Job description deleted.', id: deleted.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
