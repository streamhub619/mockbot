-- Run once to add the password_resets table.
-- Safe to run on an existing database.

CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token
  ON password_resets(token);

CREATE INDEX IF NOT EXISTS idx_password_resets_user
  ON password_resets(user_id);
