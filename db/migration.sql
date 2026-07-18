-- Run this once to add the ai_tailored session type.
-- Safe to run on an existing database — it only alters the CHECK constraint.

ALTER TABLE interview_sessions
  DROP CONSTRAINT IF EXISTS interview_sessions_session_type_check;

ALTER TABLE interview_sessions
  ADD CONSTRAINT interview_sessions_session_type_check
  CHECK (session_type IN ('resume_tailored', 'ai_tailored', 'roulette', 'quick'));
