-- ============================================
-- Add Link Column to Banners Table
-- Migration: 003_add_banner_link.sql
-- ============================================

-- Add link column to banners table (optional URL for clickable banners)
ALTER TABLE banners 
ADD COLUMN IF NOT EXISTS link VARCHAR(500);

-- Add comment
COMMENT ON COLUMN banners.link IS 'Optional URL - if provided, banner becomes clickable and redirects to this URL';
