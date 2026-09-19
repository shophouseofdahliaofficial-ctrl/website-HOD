-- Custom URL for Account page "Download our App" row (mobile).
-- Run once. Admin sets the link under More > Download our App.
INSERT INTO site_content (content_type, title, content, metadata)
VALUES ('app_download', 'Download our App', 'Mobile app store link for Account page.', '{"downloadAppUrl":""}')
ON CONFLICT (content_type) DO NOTHING;
