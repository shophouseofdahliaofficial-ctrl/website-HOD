-- ============================================
-- Add Link Target Column to Banners Table
-- Migration: 005_add_banner_link_target.sql
-- ============================================

ALTER TABLE banners
ADD COLUMN IF NOT EXISTS link_target VARCHAR(20) NOT NULL DEFAULT 'same_tab';

-- Ensure only supported values are stored
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'banners_link_target_check'
  ) THEN
    ALTER TABLE banners
    ADD CONSTRAINT banners_link_target_check
    CHECK (link_target IN ('same_tab', 'new_tab'));
  END IF;
END
$$;

COMMENT ON COLUMN banners.link_target IS 'Where banner link opens: same_tab or new_tab';
