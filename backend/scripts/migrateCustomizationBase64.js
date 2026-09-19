/**
 * Migrate base64 customization images in Postgres to Cloudinary URLs.
 *
 * Usage (from milko-backend-main/milko-backend-main):
 *   node scripts/migrateCustomizationBase64.js
 *   node scripts/migrateCustomizationBase64.js 1
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { query } = require('../src/config/database');
const {
  sanitizeCustomizationOptions,
  sanitizeCustomizationCombinations,
} = require('../src/utils/customizationAssets');

async function migrateProduct(productId) {
  const result = await query(
    'SELECT id, name, customization_options, customization_combinations FROM products WHERE id = $1',
    [productId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Product ${productId} not found`);
  }

  const beforeOptions = JSON.stringify(row.customization_options || []).length;
  const beforeCombinations = JSON.stringify(row.customization_combinations || []).length;

  console.log(`[migrate] Product ${row.id} (${row.name})`);
  console.log(`[migrate] customization_options JSON size before: ${beforeOptions} chars`);
  console.log(`[migrate] customization_combinations JSON size before: ${beforeCombinations} chars`);

  const customizationOptions = await sanitizeCustomizationOptions(row.customization_options, row.id);
  const customizationCombinations = await sanitizeCustomizationCombinations(
    row.customization_combinations,
    row.id,
  );

  await query(
    `
    UPDATE products
    SET customization_options = $1::jsonb,
        customization_combinations = $2::jsonb,
        updated_at = NOW()
    WHERE id = $3
    `,
    [
      JSON.stringify(customizationOptions),
      JSON.stringify(customizationCombinations),
      row.id,
    ],
  );

  const afterOptions = JSON.stringify(customizationOptions).length;
  const afterCombinations = JSON.stringify(customizationCombinations).length;

  console.log(`[migrate] customization_options JSON size after: ${afterOptions} chars`);
  console.log(`[migrate] customization_combinations JSON size after: ${afterCombinations} chars`);
  console.log('[migrate] Done.');
}

async function main() {
  const productId = process.argv[2] || '1';
  await migrateProduct(productId);
  process.exit(0);
}

main().catch((error) => {
  console.error('[migrate] Failed:', error.message || error);
  process.exit(1);
});
