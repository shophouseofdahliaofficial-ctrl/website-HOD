const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

/**
 * Run Product Fields and Categories Migration
 * Adds new fields to products table and creates categories table
 */
async function runMigration() {
  try {
    console.log('🔄 Running product fields and categories migration...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add_product_fields_and_categories.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Added to products table:');
    console.log('  - quantity (INTEGER)');
    console.log('  - low_stock_threshold (INTEGER)');
    console.log('  - category_id (INTEGER)');
    console.log('');
    console.log('Created categories table with:');
    console.log('  - id (SERIAL PRIMARY KEY)');
    console.log('  - name (VARCHAR UNIQUE)');
    console.log('  - description (TEXT)');
    console.log('  - created_at, updated_at (TIMESTAMP)');
    console.log('');
    console.log('Updated product_variations table:');
    console.log('  - Added price column (DECIMAL)');
    console.log('  - Migrated existing data from price_multiplier');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
