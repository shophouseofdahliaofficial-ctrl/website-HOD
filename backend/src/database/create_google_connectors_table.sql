-- Migration: Create google_connectors table
-- Stores Google OAuth refresh tokens per user per scope (drive / photos)

CREATE TABLE IF NOT EXISTS google_connectors (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('drive', 'photos')),
  refresh_token TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, scope)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_google_connectors_user_id ON google_connectors(user_id);

-- Auto-update updated_at on row modification
CREATE TRIGGER update_google_connectors_updated_at
  BEFORE UPDATE ON google_connectors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
