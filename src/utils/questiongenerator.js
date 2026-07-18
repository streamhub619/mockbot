// src/utils/questiongenerator.js
// Calls Gemini to generate tailored interview questions from resume + JD text,
// then persists them in the questions table so the session flow works identically
// to the rules-based path.

const { query } = require('../config/db');

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent`;

/**
 * Generate and persist interview questions for a resume_tailored AI session.
 *
 * @param {string} resumeText       Raw text extracted from the uploaded resume
 * @param {string} jobDescription   Job description text
 * @param {number} techCount        Number of technical questions (default 5)
 * @param {number} behavCount       Number of behavioral questions (default 2)
 * @returns {Promise<number[]>}     Array of question IDs saved to the DB
 */
async function generateQuestions(resumeText, jobDescription, techCount = 5, behavCount = 2) {
  const total  = techCount + behavCount;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Cannot generate AI questions.');
  }

  const prompt = `You are MockBot, an expert technical interview question generator.

Given the candidate's resume and the job description below, generate exactly ${total} interview questions:
- ${techCount} technical questions that target the intersection of the candidate's skills and the role's requirements
- ${behavCount} behavioral questions relevant to the seniority and role type

Respond ONLY with a valid JSON array — no markdown, no code fences, no preamble:
[
  {
    "text": "Full question text here",
    "type": "technical",
    "category": "One of: Data Structures | Algorithms | System Design | APIs | Databases | OOP | DevOps | General CS",
    "difficulty": "easy | medium | hard",
    "hint": "Comma-separated key concepts a strong answer must cover"
  }
]

RESUME:
${resumeText.slice(0, 2500)}

JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.4,
        maxOutputTokens: 2000,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Gemini question generation error:', JSON.stringify(data));
    throw new Error(`Gemini API error: ${data.error?.message || response.statusText}`);
  }

  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = raw.replace(/```json\n?|```\n?/g, '').trim();

  let questions;
  try {
    questions = JSON.parse(clean);
    if (!Array.isArray(questions)) throw new Error('Response is not an array');
  } catch (err) {
    console.error('Gemini returned invalid JSON:', raw);
    throw new Error('AI question generation failed — invalid response format.');
  }

  // Persist each question and collect IDs
  const ids = [];
  for (const q of questions) {
    const { rows: [saved] } = await query(
      `INSERT INTO questions (text, type, category, difficulty, hint, is_generic)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING id`,
      [
        q.text     || 'Question text missing',
        q.type     === 'behavioral' ? 'behavioral' : 'technical',
        q.category || 'General CS',
        ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
        q.hint     || '',
      ]
    );
    ids.push(saved.id);
  }

  return ids;
}

module.exports = { generateQuestions };
