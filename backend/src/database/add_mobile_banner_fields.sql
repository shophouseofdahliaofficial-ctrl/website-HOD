-- ============================================
-- Add Mobile Banner Support and Adapt to First Image
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Add mobile image columns
ALTER TABLE banners 
ADD COLUMN IF NOT EXISTS mobile_image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS mobile_image_public_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS adapt_to_first_image BOOLEAN NOT NULL DEFAULT false;

-- Add comments
COMMENT ON COLUMN banners.mobile_image_url IS 'Mobile-specific banner image URL (optional)';
COMMENT ON COLUMN banners.mobile_image_public_id IS 'Cloudinary public ID for mobile image';
COMMENT ON COLUMN banners.adapt_to_first_image IS 'If true, banner container adapts height to first image';
