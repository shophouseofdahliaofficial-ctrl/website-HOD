/**
 * Dev DB setup for Milko backend (no psql required)
 *
 * - Applies schema from src/database/schema.sql
 * - Creates/updates an admin user (bcrypt password)
 * - Inserts sample products (if none exist)
 *
 * Usage:
 *   node src/database/dev_setup.js --adminEmail admin@milko.in --adminPassword Admin@123
 *
 * Requires:
 *   DATABASE_URL env var pointing to a Postgres database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
    args[key] = val;
    if (val !== 'true') i += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Example: postgresql://user:pass@host:5432/db');
    process.exit(1);
  }

  const adminEmail = args.adminEmail || process.env.ADMIN_EMAIL || 'admin@milko.in';
  const adminPassword = args.adminPassword || process.env.ADMIN_PASSWORD || 'Admin@123';

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Applying schema...');
  await pool.query(schemaSql);
  console.log('✓ Schema applied');

  console.log('Creating/updating admin user...');
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await pool.query(
    `
    INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
    VALUES ($1, $2, $3, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = 'admin',
      updated_at = CURRENT_TIMESTAMP
    `,
    ['Admin User', adminEmail, passwordHash]
  );
  console.log(`✓ Admin ready: ${adminEmail} / ${adminPassword}`);

  console.log('Seeding sample products (if empty)...');
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if ((rows[0]?.count || 0) === 0) {
    await pool.query(
      `
      INSERT INTO products (name, description, price_per_litre, is_active, created_at, updated_at)
      VALUES
        ('Cow Milk', 'Fresh, pure cow milk delivered daily. Rich in protein and calcium.', 60.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Buffalo Milk', 'Creamy buffalo milk with higher fat content. Perfect for making curd and ghee.', 70.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    );
    console.log('✓ Sample products inserted');
  } else {
    console.log('✓ Products already exist, skipping');
  }

  await pool.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Dev setup failed:', err);
  process.exit(1);
});


