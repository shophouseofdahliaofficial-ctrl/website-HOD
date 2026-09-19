-- Photobook editor projects: JSON in Postgres, customer images + preview + PDF on Bunny CDN.

CREATE TABLE IF NOT EXISTS photobook_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variation_id INTEGER,
  project_name TEXT NOT NULL DEFAULT 'My Project',
  project_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_url TEXT,
  generated_pdf_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price DECIMAL(10, 2),
  asset_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'cart', 'purchased')),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  page_count INTEGER NOT NULL DEFAULT 0,
  last_edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photobook_projects_user_id ON photobook_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_photobook_projects_last_edited ON photobook_projects(last_edited_at DESC);
CREATE INDEX IF NOT EXISTS idx_photobook_projects_expires_at ON photobook_projects(expires_at);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS photobook_project_id UUID REFERENCES photobook_projects(id) ON DELETE SET NULL;
