const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
require('dotenv').config();

/**
 * Enable Row Level Security on all public tables.
 *
 * Usage (from milko-backend-main/milko-backend-main):
 *   node src/database/run_rls_migration.js
 */
async function runRlsMigration() {
  const sqlPath = path.join(__dirname, 'migrations', '011_enable_rls_all_public_tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('[RLS] Applying Row Level Security migration...');
  await query(sql);
  console.log('[RLS] Done. Re-check Supabase Dashboard → Security Advisor.');
}

runRlsMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[RLS] Migration failed:', error.message || error);
    process.exit(1);
  });
