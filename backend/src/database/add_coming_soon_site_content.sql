-- Add 'coming_soon' content type to site_content.
-- Used for "We are coming" mode: is_active = true means coming soon page is shown to customers.
-- Admins bypass via "access through password" (same as admin panel password).
-- Toggle in Admin > More > Coming Soon Mode.

INSERT INTO site_content (content_type, title, content, metadata, is_active)
VALUES ('coming_soon', 'We will be back soon', 'We are working behind the scenes to craft something extraordinary for you.', '{}', false)
ON CONFLICT (content_type) DO UPDATE SET 
  title = EXCLUDED.title,
  content = EXCLUDED.content;
