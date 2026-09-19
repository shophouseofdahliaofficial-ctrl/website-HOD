-- Add 'logo' content type to site_content for logo upload (Cloudinary) and width.
-- Run this in Supabase SQL Editor or your PostgreSQL client if you want the row to exist before first upload.
-- metadata: { imageUrl?, imagePublicId?, widthPx? } — imageUrl and imagePublicId are set when admin uploads via Admin > More > Logo.
-- The API (POST /api/admin/logo) can also create this row on first upload; this migration is optional.

INSERT INTO site_content (content_type, title, content, metadata)
VALUES ('logo', 'Logo', '', '{"widthPx": 120}')
ON CONFLICT (content_type) DO NOTHING;
