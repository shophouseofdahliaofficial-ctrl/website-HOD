-- ============================================
-- Add Link Column to Banners Table
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Add link column to banners table (optional URL for clickable banners)
ALTER TABLE banners 
ADD COLUMN IF NOT EXISTS link VARCHAR(500);

-- Add comment
COMMENT ON COLUMN banners.link IS 'Optional URL - if provided, banner becomes clickable and redirects to this URL';
