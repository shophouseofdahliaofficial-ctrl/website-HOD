-- Add product customization fields for advanced variations and customizable notebook features.
ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_options JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_combinations JSONB NOT NULL DEFAULT '[]'::jsonb;
