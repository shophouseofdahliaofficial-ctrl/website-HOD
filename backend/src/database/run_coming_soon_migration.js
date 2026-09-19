const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Run Coming Soon site_content migration
 * Inserts 'coming_soon' content type for "We are coming" mode toggle
 */
async function runMigration() {
  try {
    console.log('[MIGRATION] Running coming_soon site_content migration...');

    const sqlFile = path.join(__dirname, 'add_coming_soon_site_content.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    await query(sql);

    console.log('[MIGRATION] ✅ coming_soon migration completed.');
  } catch (error) {
    console.error('[MIGRATION] ❌ Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runMigration };
