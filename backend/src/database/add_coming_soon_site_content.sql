-- Add 'coming_soon' content type to site_content.
-- Used for "We are coming" mode: is_active = true means coming soon page is shown to customers.
-- Admins bypass via "access through password" (same as admin panel password).
-- Toggle in Admin > More > Coming Soon Mode.

INSERT INTO site_content (content_type, title, content, metadata, is_active)
VALUES ('coming_soon', 'We will be back, but this time 2X Stronger', 'We’re working behind the scenes to bring you 100% pure, chemical-free milk and dairy products.', '{}', false)
ON CONFLICT (content_type) DO NOTHING;
