// src/utils/questiongenerator.js

const { query } = require('../config/db');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

async function callGemini(prompt, maxTokens = 2000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  const res = await fetch(`${GEMINI_BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini API error: ${data.error?.message || res.statusText}`);
  }

  const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = raw.replace(/```json\n?|```\n?/g, '').trim();
  return clean;
}

// ─── Resume-tailored session questions (saves to questions table) ─────────────
async function generateQuestions(resumeText, jobDescription, techCount = 5, behavCount = 2) {
  const total  = techCount + behavCount;

  const prompt = `You are MockBot, an expert technical interview question generator.
Given the candidate's resume and the job description below, generate exactly ${total} interview questions:
- ${techCount} technical questions that target the intersection of the candidate's skills and the role
- ${behavCount} behavioral questions relevant to the seniority and role type

Respond ONLY with a valid JSON array — no markdown, no code fences, no preamble:
[{"text":"...","type":"technical","category":"Data Structures|Algorithms|System Design|APIs|Databases|OOP|DevOps|General CS","difficulty":"easy|medium|hard","hint":"key concepts a strong answer must cover"}]

RESUME:
${resumeText.slice(0, 2500)}

JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}`;

  const raw       = await callGemini(prompt, 2000);
  const questions = JSON.parse(raw);
  if (!Array.isArray(questions)) throw new Error('Response is not an array');

  const ids = [];
  for (const q of questions) {
    const { rows: [saved] } = await query(
      `INSERT INTO questions (text, type, category, difficulty, hint, is_generic)
       VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
      [
        q.text     || 'Question missing',
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

// ─── Roulette questions (NOT saved to questions table) ────────────────────────
// Returns plain objects — stored directly in roulette_rounds.
// No resume needed; generates a diverse general-purpose interview set.
async function generateRouletteQuestions(count = 7) {
  const techCount  = count - 2;
  const behavCount = 2;

  const prompt = `You are MockBot. Generate ${count} diverse software engineering interview questions for a peer mock interview session.
- ${techCount} technical questions spanning different areas: algorithms, system design, databases, APIs, OOP, and general CS concepts. Vary the difficulty.
- ${behavCount} behavioral questions using the STAR method format.

Respond ONLY with a valid JSON array — no markdown, no code fences:
[{"text":"...","type":"technical","category":"Algorithms|System Design|Databases|APIs|OOP|General CS"}]

Make the questions interesting and specific — avoid generic filler questions.`;

  const raw       = await callGemini(prompt, 1500);
  const questions = JSON.parse(raw);
  if (!Array.isArray(questions)) throw new Error('Roulette question response is not an array');

  return questions.slice(0, count).map((q, i) => ({
    round_number:      i + 1,
    question_text:     q.text     || `Question ${i + 1}`,
    question_type:     q.type     === 'behavioral' ? 'behavioral' : 'technical',
    question_category: q.category || 'General CS',
  }));
}

module.exports = { generateQuestions, generateRouletteQuestions };
