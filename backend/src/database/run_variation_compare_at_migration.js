/**
 * Adds product_variations.compare_at_price if missing.
 *
 * Run: npm run db:migrate-variation-compare-at
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const encodeDbUrlPassword = (url) => {
  if (!url || !url.includes('://') || !url.includes('@')) return url;
  if (url.includes('%')) return url;
  try {
    const protocolEnd = url.indexOf('://') + 3;
    const lastAt = url.lastIndexOf('@');
    if (lastAt <= protocolEnd) return url;
    const userInfo = url.slice(protocolEnd, lastAt);
    const firstColon = userInfo.indexOf(':');
    if (firstColon === -1) return url;
    const password = userInfo.slice(firstColon + 1);
    if (!/[ @:/?#]/.test(password)) return url;
    const username = userInfo.slice(0, firstColon);
    const hostAndDb = url.slice(lastAt + 1);
    return `${url.slice(0, protocolEnd)}${username}:${encodeURIComponent(password)}@${hostAndDb}`;
  } catch {
    return url;
  }
};

async function runMigration() {
  const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ SUPABASE_DB_URL or DATABASE_URL is not set');
    process.exit(1);
  }

  const fixedUrl = encodeDbUrlPassword(databaseUrl);
  const pool = new Pool({
    connectionString: fixedUrl,
    ssl: fixedUrl?.includes('supabase')
      ? { rejectUnauthorized: false }
      : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
    connectionTimeoutMillis: 30000,
  });

  try {
    const sqlPath = path.join(__dirname, 'migrations', '004_add_product_variations_compare_at_price.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration: migrations/004_add_product_variations_compare_at_price.sql');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw e;
    } finally {
      client.release();
    }
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch {
      // ignore
    }
  }
}

runMigration();
