const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Run Site Content Table Migration
 * Creates the site_content table and inserts default content
 */
async function runMigration() {
  try {
    console.log('[MIGRATION] Starting site content table migration...');

    const sqlFile = path.join(__dirname, 'create_site_content_table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Execute the SQL
    await query(sql);

    console.log('[MIGRATION] ✅ Site content table migration completed successfully!');
    console.log('[MIGRATION] Default content has been inserted.');
    console.log('[MIGRATION] Content types: terms, privacy, about, contact, reviews');
  } catch (error) {
    console.error('[MIGRATION] ❌ Migration failed:', error.message);
    if (error.stack) {
      console.error('[MIGRATION] Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('[MIGRATION] Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MIGRATION] Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
