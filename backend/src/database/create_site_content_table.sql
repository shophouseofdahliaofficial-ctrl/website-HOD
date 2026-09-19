-- Site Content Table
-- Stores editable content like Terms, Privacy, About, Contact, etc.

CREATE TABLE IF NOT EXISTS site_content (
  id SERIAL PRIMARY KEY,
  content_type VARCHAR(50) UNIQUE NOT NULL, -- 'terms', 'privacy', 'about', 'contact', 'reviews'
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB, -- For storing additional data like contact details, review settings, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_site_content_type ON site_content(content_type);
CREATE INDEX IF NOT EXISTS idx_site_content_active ON site_content(is_active);

-- Insert default content
INSERT INTO site_content (content_type, title, content, metadata) VALUES
  ('terms', 'Terms and Conditions', 'Default terms and conditions content. Please update this content.', '{}'),
  ('privacy', 'Privacy Policy', 'Welcome to MyScribble. We are committed to protecting your privacy. This Privacy Policy explains how we collect and use your data when you connect third-party services (Google Connectors like Google Drive and Google Photos).<br><br><b>How Long Do Connections Last?</b><br>When you authorize a connection to Google Drive or Google Photos, MyScribble receives and securely stores a unique refresh token. This connection lasts indefinitely, allowing you to browse and upload files directly from your Google accounts without needing to re-authenticate each time. You can disconnect your accounts at any time from your settings panel, which immediately deletes the stored refresh tokens from our systems. You can also revoke access directly through your Google Account Security Settings page (https://myaccount.google.com/permissions).', '{}'),
  ('about', 'About Us', 'Default about us content. Please update this content.', '{}'),
  ('contact', 'Contact Us', 'Contact information', '{"email": "contact@milko.in", "phone": "+91 1234567890", "address": "Your Address Here"}'),
  ('reviews', 'Reviews Settings', 'Reviews management settings', '{"allowPublicReviews": true, "requireApproval": true}'),
  -- pincodes: metadata.serviceablePincodes = [{"pincode":"110001","deliveryTime":"1h"}, ...]
  -- deliveryTime: "1h", "2h", "15m", "30m" etc. (displayed as 1hr, 2hr, 15m in header)
  ('pincodes', 'Pincode Settings', 'Delivery pincode settings', '{"serviceablePincodes": []}'),
  -- logo: metadata.imageUrl (Cloudinary), metadata.imagePublicId, metadata.widthPx (40–320)
  ('logo', 'Logo', '', '{"widthPx": 120}'),
  -- homepage_products: metadata.rows = number of rows to show on homepage "Our Products"
  ('homepage_products', 'Homepage Products Rows', 'Homepage products section settings.', '{"rows": 1}')
ON CONFLICT (content_type) DO NOTHING;
