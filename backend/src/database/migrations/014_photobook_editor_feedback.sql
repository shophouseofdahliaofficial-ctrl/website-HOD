-- Photobook editor in-app feedback (issue type, star rating, message).

CREATE TABLE IF NOT EXISTS photobook_editor_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  project_id UUID REFERENCES photobook_projects(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photobook_editor_feedback_created
  ON photobook_editor_feedback(created_at DESC);
