const { query } = require('../config/database');

let creatorSchemaEnsured = false;
const ensureCreatorTable = async () => {
  if (creatorSchemaEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS creators (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      products_title VARCHAR(255) DEFAULT 'Our Products',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS product_ids JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS products_title VARCHAR(255) DEFAULT 'Our Products';`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS creator_slug VARCHAR(255);`);
  creatorSchemaEnsured = true;
};

const transformCreator = (row) => {
  if (!row) return null;
  let productIds = [];
  if (Array.isArray(row.product_ids)) {
    productIds = row.product_ids;
  } else if (typeof row.product_ids === 'string') {
    try {
      productIds = JSON.parse(row.product_ids);
    } catch {
      productIds = [];
    }
  }
  return {
    id: row.id.toString(),
    name: row.name,
    slug: row.slug,
    productIds,
    productsTitle: row.products_title || 'Our Products',
    salesCount: row.sales_count !== undefined ? parseInt(row.sales_count || 0, 10) : undefined,
    salesMoney: row.sales_money !== undefined ? parseFloat(row.sales_money || 0) : undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
};

const createCreator = async (creatorData) => {
  await ensureCreatorTable();
  const { name, slug, productIds = [], productsTitle = 'Our Products' } = creatorData;
  const result = await query(
    `INSERT INTO creators (name, slug, product_ids, products_title, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, NOW(), NOW())
     RETURNING *`,
    [name, slug, JSON.stringify(productIds), productsTitle]
  );
  return transformCreator(result.rows[0]);
};

const getAllCreators = async () => {
  await ensureCreatorTable();
  const result = await query(`
    SELECT 
      c.*,
      COALESCE(s.sales_count, 0)::integer AS sales_count,
      COALESCE(s.sales_money, 0)::numeric AS sales_money
    FROM creators c
    LEFT JOIN LATERAL (
      SELECT 
        SUM(oi.quantity) AS sales_count,
        SUM(oi.line_total) AS sales_money
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.creator_slug = c.slug
        AND o.payment_status IN ('paid', 'cod')
        AND c.product_ids @> jsonb_build_array(oi.product_id::text)
    ) s ON true
    ORDER BY c.name ASC
  `);
  return result.rows.map(transformCreator);
};

const getCreatorBySlug = async (slug) => {
  await ensureCreatorTable();
  const result = await query(`
    SELECT 
      c.*,
      COALESCE(s.sales_count, 0)::integer AS sales_count,
      COALESCE(s.sales_money, 0)::numeric AS sales_money
    FROM creators c
    LEFT JOIN LATERAL (
      SELECT 
        SUM(oi.quantity) AS sales_count,
        SUM(oi.line_total) AS sales_money
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.creator_slug = c.slug
        AND o.payment_status IN ('paid', 'cod')
        AND c.product_ids @> jsonb_build_array(oi.product_id::text)
    ) s ON true
    WHERE c.slug = $1
  `, [slug]);
  return transformCreator(result.rows[0] || null);
};

const updateCreator = async (id, updates) => {
  await ensureCreatorTable();
  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updates).forEach((key) => {
    fields.push(`${key} = $${paramCount}`);
    values.push(updates[key]);
    paramCount++;
  });

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE creators 
     SET ${fields.join(', ')} 
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  return transformCreator(result.rows[0] || null);
};

const deleteCreator = async (id) => {
  await ensureCreatorTable();
  const result = await query('DELETE FROM creators WHERE id = $1 RETURNING *', [id]);
  return transformCreator(result.rows[0] || null);
};

module.exports = {
  createCreator,
  getAllCreators,
  getCreatorBySlug,
  updateCreator,
  deleteCreator
};
