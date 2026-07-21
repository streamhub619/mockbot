-- MockBot — Roulette Upgrade Migration
-- Run once: psql -U postgres -d mockbot_db -f db/roulette-upgrade-migration.sql

-- 1. Add preferred_role to roulette_pool
ALTER TABLE roulette_pool
  ADD COLUMN IF NOT EXISTS preferred_role VARCHAR(20) DEFAULT 'any'
    CHECK (preferred_role IN ('interviewer', 'interviewee', 'any'));

-- 2. Add role columns + round tracking to roulette_matches
ALTER TABLE roulette_matches
  ADD COLUMN IF NOT EXISTS role_a         VARCHAR(20) DEFAULT 'interviewer',
  ADD COLUMN IF NOT EXISTS role_b         VARCHAR(20) DEFAULT 'interviewee',
  ADD COLUMN IF NOT EXISTS current_round  INTEGER     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_rounds   INTEGER     DEFAULT 7;

-- Update the status check constraint to include 'generating'
ALTER TABLE roulette_matches
  DROP CONSTRAINT IF EXISTS roulette_matches_status_check;
ALTER TABLE roulette_matches
  ADD CONSTRAINT roulette_matches_status_check
    CHECK (status IN ('waiting', 'generating', 'active', 'completed'));

-- 3. New roulette_rounds table — one row per question per match
CREATE TABLE IF NOT EXISTS roulette_rounds (
  id                SERIAL PRIMARY KEY,
  match_id          INTEGER     NOT NULL REFERENCES roulette_matches(id) ON DELETE CASCADE,
  round_number      INTEGER     NOT NULL,
  question_text     TEXT        NOT NULL,
  question_type     VARCHAR(20) DEFAULT 'technical',
  question_category VARCHAR(100),
  answer_text       TEXT,
  score             NUMERIC(4,2),
  verdict           VARCHAR(20) CHECK (verdict IN ('Strong', 'Adequate', 'Needs Work')),
  strengths         JSONB       DEFAULT '[]',
  missed            JSONB       DEFAULT '[]',
  improvements      JSONB       DEFAULT '[]',
  overall_feedback  TEXT,
  submitted_at      TIMESTAMPTZ,
  UNIQUE (match_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_roulette_rounds_match
  ON roulette_rounds(match_id);
