const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const pdfParse  = require('pdf-parse');
const mammoth   = require('mammoth');

const { authenticate }        = require('../middleware/auth');
const { upload }              = require('../middleware/upload');
const ResumeModel             = require('../models/resume.model');
const { extractSkills }       = require('../utils/skillextractor');

const router = express.Router();

// All resume routes require authentication
router.use(authenticate);

// POST /api/resumes  — upload a CV (PDF or DOCX)
router.post('/', upload.single('resume'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please attach a PDF or DOCX file.' });
  }

  try {
    const rawText = await extractTextFromFile(req.file.path, req.file.mimetype);
    const parsedSkills = extractSkills(rawText);

    const resume = await ResumeModel.create({
      userId:       req.userId,
      filename:     req.file.originalname,
      filePath:     req.file.path,
      rawText,
      parsedSkills,
    });

    return res.status(201).json({
      message: 'Resume uploaded and parsed successfully.',
      resume: {
        id:           resume.id,
        filename:     resume.filename,
        parsedSkills: resume.parsed_skills,
        uploadedAt:   resume.uploaded_at,
      },
    });
  } catch (err) {
    // Clean up the uploaded file if DB insert failed
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(err);
  }
});

// GET /api/resumes  — list current user's resumes
router.get('/', async (req, res, next) => {
  try {
    const resumes = await ResumeModel.findAllByUser(req.userId);
    return res.json({ resumes });
  } catch (err) {
    next(err);
  }
});

// GET /api/resumes/:id  — get one resume with full text
router.get('/:id', async (req, res, next) => {
  try {
    const resume = await ResumeModel.findById(req.params.id, req.userId);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });
    return res.json({ resume });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/resumes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const resume = await ResumeModel.findById(req.params.id, req.userId);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    await ResumeModel.delete(req.params.id, req.userId);

    // Delete the file from disk
    if (resume.file_path) fs.unlink(resume.file_path, () => {});

    return res.json({ message: 'Resume deleted.', id: resume.id });
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function extractTextFromFile(filePath, mimetype) {
  if (mimetype === 'application/pdf') {
    const buffer = fs.readFileSync(filePath);
    const data   = await pdfParse(buffer);
    return data.text;
  }

  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw Object.assign(new Error('Unsupported file type.'), { statusCode: 415 });
}

module.exports = router;
