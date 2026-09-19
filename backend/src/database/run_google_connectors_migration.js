/**
 * Run the google_connectors table migration.
 */
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

async function runMigration() {
  console.log('🔄 Running google_connectors migration...');

  const sqlPath = path.join(__dirname, 'create_google_connectors_table.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Split by semicolon, filter out empty / comment-only chunks
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      // Remove comment-only lines
      const withoutComments = s.replace(/--.*$/gm, '').trim();
      return withoutComments.length > 0;
    });

  for (const statement of statements) {
    try {
      console.log('  ▶ Running:', statement.substring(0, 80) + (statement.length > 80 ? '...' : ''));
      await query(statement + ';');
      console.log('    ✅ Done');
    } catch (error) {
      if (
        error.message?.includes('already exists') ||
        error.message?.includes('duplicate')
      ) {
        console.log('    ⏭️  Skipped (already exists)');
      } else {
        console.error('    ❌ Error:', error.message);
      }
    }
  }

  console.log('✅ google_connectors migration complete.');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
