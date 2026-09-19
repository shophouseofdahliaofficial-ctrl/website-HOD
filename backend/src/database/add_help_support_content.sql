-- Help support number for "Need help" button (WhatsApp, Telegram, etc.)
-- Run once to create the content type. Admin can then set the number in More > Help support number.
INSERT INTO site_content (content_type, title, content, metadata)
VALUES ('help_support', 'Help support number', 'Support contact for Need help button.', '{"helpSupportNumber":""}')
ON CONFLICT (content_type) DO NOTHING;
