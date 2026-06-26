-- PostgreSQL Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(200)        NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255)        NOT NULL,
  created_at    TIMESTAMPTZ         DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         DEFAULT NOW()
);

-- resumes
CREATE TABLE IF NOT EXISTS resumes (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename       VARCHAR(255),
  file_path      VARCHAR(500),
  raw_text       TEXT,
  parsed_skills  JSONB       DEFAULT '[]',
  uploaded_at    TIMESTAMPTZ DEFAULT NOW()
);

-- job descriptions
CREATE TABLE IF NOT EXISTS job_descriptions (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(255),
  company           VARCHAR(255),
  description_text  TEXT        NOT NULL,
  required_skills   JSONB       DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- skills
-- category: language | framework | database | tool | concept | soft_skill
CREATE TABLE IF NOT EXISTS skills (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) UNIQUE NOT NULL,
  category   VARCHAR(50)  DEFAULT 'general',
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- questions
CREATE TABLE IF NOT EXISTS questions (
  id          SERIAL PRIMARY KEY,
  text        TEXT        NOT NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('technical', 'behavioral')),
  category    VARCHAR(100),              -- e.g. 'Data Structures', 'System Design'
  difficulty  VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard')),
  hint        TEXT,                      -- key concepts the answer should cover
  is_generic  BOOLEAN     DEFAULT FALSE, -- TRUE = from seed pool; FALSE = AI-generated
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- rubric
-- Each row is one criterion for a question's evaluation rubric.
CREATE TABLE IF NOT EXISTS rubrics (
  id          SERIAL PRIMARY KEY,
  question_id INTEGER      NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  criterion   TEXT         NOT NULL,
  keywords    JSONB        DEFAULT '[]', -- signal words that indicate coverage
  weight      NUMERIC(3,2) DEFAULT 1.0,
  order_index INTEGER      DEFAULT 0
);

-- interview session
CREATE TABLE IF NOT EXISTS interview_sessions (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id           INTEGER     REFERENCES resumes(id)          ON DELETE SET NULL,
  job_description_id  INTEGER     REFERENCES job_descriptions(id)  ON DELETE SET NULL,
  session_type        VARCHAR(20) NOT NULL
                        CHECK (session_type IN ('resume_tailored', 'roulette', 'quick')),
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'completed', 'abandoned')),
  total_score         NUMERIC(5,2),
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- session questions
CREATE TABLE IF NOT EXISTS session_questions (
  id          SERIAL  PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  order_index INTEGER NOT NULL,
  UNIQUE (session_id, order_index)
);

-- answers
CREATE TABLE IF NOT EXISTS answers (
  id               SERIAL PRIMARY KEY,
  session_id       INTEGER     NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id      INTEGER     NOT NULL REFERENCES questions(id),
  user_id          INTEGER     NOT NULL REFERENCES users(id),
  answer_text      TEXT        NOT NULL,
  score            NUMERIC(4,2),
  verdict          VARCHAR(20) CHECK (verdict IN ('Strong', 'Adequate', 'Needs Work')),
  strengths        JSONB       DEFAULT '[]',
  missed           JSONB       DEFAULT '[]',
  improvements     JSONB       DEFAULT '[]',
  logic_check      JSONB       DEFAULT '{}',
  overall_feedback TEXT,
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, question_id)
);

-- roulette waiting pool
CREATE TABLE IF NOT EXISTS roulette_pool (
  id         SERIAL  PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES interview_sessions(id),
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- roulette matches
CREATE TABLE IF NOT EXISTS roulette_matches (
  id            SERIAL  PRIMARY KEY,
  user_id_a     INTEGER NOT NULL REFERENCES users(id), -- interviewer
  user_id_b     INTEGER NOT NULL REFERENCES users(id), -- interviewee
  session_id_a  INTEGER REFERENCES interview_sessions(id),
  session_id_b  INTEGER REFERENCES interview_sessions(id),
  question_id   INTEGER REFERENCES questions(id),
  status        VARCHAR(20) DEFAULT 'waiting'
                  CHECK (status IN ('waiting', 'active', 'completed')),
  time_limit    INTEGER     DEFAULT 300,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_resumes_user             ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_jd_user                  ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user            ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status          ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_session_questions_sid    ON session_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_session          ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_user             ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_rubrics_question         ON rubrics(question_id);
CREATE INDEX IF NOT EXISTS idx_roulette_pool_joined     ON roulette_pool(joined_at);
CREATE INDEX IF NOT EXISTS idx_roulette_matches_status  ON roulette_matches(status);

-- auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();