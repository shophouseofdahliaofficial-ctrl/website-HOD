const { query } = require('../config/database');

async function run() {
  try {
    const sql = `
      INSERT INTO site_content (content_type, title, content, metadata, is_active)
      VALUES (
        'refunds',
        'Exchanges & Refunds',
        'At House Of Dahlia, we take pride in delivering premium quality, finely crafted products. Here is our policy regarding exchanges, returns, and refunds.

1. Eligibility for Exchanges
Custom and personalized items (such as photo prints, polaroids, customized keepsakes, photobooks) are crafted uniquely for you. If an item arrives damaged, defective, or misprinted, we offer an immediate free replacement or exchange.

2. Damaged or Incorrect Items
Please notify our support team within 48 hours of delivery with photos of the damaged or incorrect item. We will dispatch a replacement immediately without extra charge.

3. Refund Process
Approved refunds will be processed to your original payment method or wallet within 5-7 business days.

4. Contact Support
If you have any questions regarding your order, please reach out to us via our Contact Us page or customer support.',
        '{}',
        true
      )
      ON CONFLICT (content_type) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content;
    `;

    await query(sql);
    console.log('[MIGRATION] ✅ refunds site_content added successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION] ❌ Failed to add refunds site_content:', error.message);
    process.exit(1);
  }
}

run();
