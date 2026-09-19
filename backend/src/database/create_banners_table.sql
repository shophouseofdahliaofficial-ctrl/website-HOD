-- ============================================
-- Create Banners Table
-- Run this SQL in your Supabase SQL Editor or via psql
-- ============================================

-- Create the banners table
CREATE TABLE IF NOT EXISTS banners (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    image_public_id VARCHAR(255),
    link VARCHAR(500), -- Optional URL - if provided, banner becomes clickable
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active banners
CREATE INDEX IF NOT EXISTS idx_banners_active 
ON banners(is_active, order_index) 
WHERE is_active = true;

-- Create trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for banners table
DROP TRIGGER IF EXISTS update_banners_updated_at ON banners;
CREATE TRIGGER update_banners_updated_at 
BEFORE UPDATE ON banners
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE banners IS 'Stores banner images for homepage carousel';
COMMENT ON COLUMN banners.order_index IS 'Order in which banners appear (lower numbers first)';
