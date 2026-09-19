-- ============================================
-- Add Banners Table
-- Migration: 002_add_banners_table.sql
-- ============================================

-- Create banners table
CREATE TABLE IF NOT EXISTS banners (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    image_public_id VARCHAR(255), -- Cloudinary public ID for deletion
    order_index INTEGER NOT NULL DEFAULT 0, -- For ordering banners
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for active banners (ordered by order_index)
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active, order_index) WHERE is_active = true;

-- Apply updated_at trigger
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE banners IS 'Stores banner images for homepage carousel';
COMMENT ON COLUMN banners.order_index IS 'Order in which banners appear (lower numbers first)';



