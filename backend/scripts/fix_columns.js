const { Client } = require('pg');
const dbUrl = 'postgresql://postgres.vulmjlmhylizgxotswmu:PZqoI0oLWgF9xgut@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

(async () => {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to DB...');

    // Products table columns
    const productAlterQueries = [
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_membership_eligible BOOLEAN NOT NULL DEFAULT false;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS max_quantity INTEGER NOT NULL DEFAULT 99;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_pincodes JSONB NOT NULL DEFAULT '[]'::jsonb;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS accordion_items JSONB NOT NULL DEFAULT '[]'::jsonb;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_time_text TEXT;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_nationwide_delivery BOOLEAN NOT NULL DEFAULT false;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_customizable BOOLEAN NOT NULL DEFAULT false;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS photobook_editor_enabled BOOLEAN NOT NULL DEFAULT false;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_now_enabled BOOLEAN NOT NULL DEFAULT true;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_again_enabled BOOLEAN NOT NULL DEFAULT true;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS polaroid_upload_enabled BOOLEAN NOT NULL DEFAULT false;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS strip_upload_enabled BOOLEAN NOT NULL DEFAULT false;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_options JSONB NOT NULL DEFAULT '[]'::jsonb;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_combinations JSONB NOT NULL DEFAULT '[]'::jsonb;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_banners JSONB NOT NULL DEFAULT '{\"images\":[],\"adaptToFullImageRatio\":false,\"displayMode\":\"stacked\"}'::jsonb;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_flipbook JSONB NOT NULL DEFAULT '{\"enabled\":false,\"sections\":[]}'::jsonb;",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3);",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS hover_next_image BOOLEAN NOT NULL DEFAULT false;"
    ];

    for (const q of productAlterQueries) {
      await client.query(q);
    }
    console.log('✅ Ensured all columns on products table!');

    // Banners table columns
    const bannerAlterQueries = [
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS link VARCHAR(500);",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS link_target VARCHAR(20) DEFAULT 'same_tab';",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255);",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS mobile_image_url VARCHAR(500);",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS mobile_image_public_id VARCHAR(255);",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS adapt_to_first_image BOOLEAN DEFAULT false;",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS desktop_display_mode VARCHAR(32) NOT NULL DEFAULT 'swipe';",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS mobile_display_mode VARCHAR(32) NOT NULL DEFAULT 'swipe';",
      "ALTER TABLE banners ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;"
    ];

    for (const q of bannerAlterQueries) {
      await client.query(q);
    }
    console.log('✅ Ensured all columns on banners table!');

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
})();
