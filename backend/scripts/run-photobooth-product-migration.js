const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const sqlPath = path.join(__dirname, '../src/database/migrations/008_photobooth_polaroid_product_id_2.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  const products = await pool.query(`
    SELECT id, name, is_photobooth_product, is_active
    FROM products
    WHERE id IN (2, 3, 4)
    ORDER BY id
  `);
  console.log('Migration complete. Products:', products.rows);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
