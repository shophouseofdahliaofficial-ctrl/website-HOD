const { query } = require('../config/database');

/**
 * Product Variation Model
 * Handles database operations for product variations (sizes)
 */

/**
 * Create a new product variation
 */
const createProductVariation = async (
  productId,
  size,
  priceMultiplier = 1.0,
  isAvailable = true,
  displayOrder = 0,
  price = null,
  compareAtPrice = null
) => {
  const cmp =
    compareAtPrice !== null && compareAtPrice !== undefined && compareAtPrice !== ''
      ? parseFloat(compareAtPrice)
      : null;
  const compareFinal = Number.isFinite(cmp) ? cmp : null;

  const result = await query(
    `INSERT INTO product_variations (product_id, size, price_multiplier, price, compare_at_price, is_available, display_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [productId, size, priceMultiplier, price, compareFinal, isAvailable, displayOrder]
  );

  return {
    id: result.rows[0].id.toString(),
    productId: result.rows[0].product_id.toString(),
    size: result.rows[0].size,
    priceMultiplier: parseFloat(result.rows[0].price_multiplier),
    price: result.rows[0].price ? parseFloat(result.rows[0].price) : null,
    compareAtPrice: result.rows[0].compare_at_price != null ? parseFloat(result.rows[0].compare_at_price) : null,
    weight: result.rows[0].weight != null ? parseFloat(result.rows[0].weight) : null,
    isAvailable: result.rows[0].is_available,
    displayOrder: result.rows[0].display_order,
    createdAt: result.rows[0].created_at.toISOString(),
    updatedAt: result.rows[0].updated_at.toISOString(),
  };
};

/**
 * Get all variations for a product
 */
const getProductVariations = async (productId) => {
  try {
    const result = await query(
      `SELECT * FROM product_variations 
       WHERE product_id = $1 
       ORDER BY display_order ASC, created_at ASC`,
      [productId]
    );

    return result.rows.map(row => ({
      id: row.id.toString(),
      productId: row.product_id.toString(),
      size: row.size,
      priceMultiplier: parseFloat(row.price_multiplier),
      price: row.price ? parseFloat(row.price) : null,
      compareAtPrice: row.compare_at_price != null ? parseFloat(row.compare_at_price) : null,
      weight: row.weight != null ? parseFloat(row.weight) : null,
      isAvailable: row.is_available,
      displayOrder: row.display_order,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  } catch (err) {
    if (err?.code === '42P01' || err?.message?.includes('relation "product_variations" does not exist')) {
      console.warn('[product_variations] Table missing (migration not applied). Returning empty variations array.');
      return [];
    }
    throw err;
  }
};

/** JSON / req.body keys → real PostgreSQL column names (never use camelCase in SQL). */
const VARIATION_COLUMN_BY_KEY = {
  size: 'size',
  price: 'price',
  priceMultiplier: 'price_multiplier',
  compareAtPrice: 'compare_at_price',
  compare_at_price: 'compare_at_price',
  weight: 'weight',
  isAvailable: 'is_available',
  is_available: 'is_available',
  displayOrder: 'display_order',
  display_order: 'display_order',
};

/**
 * Update a product variation
 */
const updateProductVariation = async (variationId, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updates || {}).forEach((key) => {
    const sqlColumn = VARIATION_COLUMN_BY_KEY[key];
    if (!sqlColumn) return;

    let val = updates[key];
    const isCompare =
      key === 'compareAtPrice' || key === 'compare_at_price';
    const isPrice = key === 'price';

    if (isCompare) {
      if (val === '' || val === undefined) val = null;
      else if (val !== null) {
        const n = parseFloat(val);
        val = Number.isFinite(n) ? n : null;
      }
    }
    if (isPrice && (val === '' || val === undefined)) val = null;
    else if (isPrice && val !== null) {
      const n = parseFloat(val);
      val = Number.isFinite(n) ? n : null;
    }

    fields.push(`${sqlColumn} = $${paramCount}`);
    values.push(val);
    paramCount++;
  });

  if (fields.length === 0) {
    const existing = await query('SELECT * FROM product_variations WHERE id = $1', [variationId]);
    if (!existing.rows[0]) return null;
    const row = existing.rows[0];
    return {
      id: row.id.toString(),
      productId: row.product_id.toString(),
      size: row.size,
      priceMultiplier: parseFloat(row.price_multiplier),
      price: row.price ? parseFloat(row.price) : null,
      compareAtPrice: row.compare_at_price != null ? parseFloat(row.compare_at_price) : null,
      weight: row.weight != null ? parseFloat(row.weight) : null,
      isAvailable: row.is_available,
      displayOrder: row.display_order,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  fields.push(`updated_at = NOW()`);
  values.push(variationId);

  const result = await query(
    `UPDATE product_variations 
     SET ${fields.join(', ')} 
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  return {
    id: row.id.toString(),
    productId: row.product_id.toString(),
    size: row.size,
    priceMultiplier: parseFloat(row.price_multiplier),
    price: row.price ? parseFloat(row.price) : null,
    compareAtPrice: row.compare_at_price != null ? parseFloat(row.compare_at_price) : null,
    weight: row.weight != null ? parseFloat(row.weight) : null,
    isAvailable: row.is_available,
    displayOrder: row.display_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
};

/**
 * Get all variations for multiple products in one query.
 * @returns {Promise<Map<string, Array>>} Map of productId -> variations
 */
const getVariationsByProductIds = async (productIds = []) => {
  const ids = productIds
    .map((id) => parseInt(String(id), 10))
    .filter((id) => Number.isFinite(id));
  if (ids.length === 0) return new Map();

  try {
    const result = await query(
      `SELECT * FROM product_variations
       WHERE product_id = ANY($1::int[])
       ORDER BY product_id ASC, display_order ASC, created_at ASC`,
      [ids]
    );

    const byProduct = new Map();
    for (const row of result.rows) {
      const productId = String(row.product_id);
      const list = byProduct.get(productId) || [];
      list.push({
        id: row.id.toString(),
        productId,
        size: row.size,
        priceMultiplier: parseFloat(row.price_multiplier),
        price: row.price ? parseFloat(row.price) : null,
        compareAtPrice: row.compare_at_price != null ? parseFloat(row.compare_at_price) : null,
        weight: row.weight != null ? parseFloat(row.weight) : null,
        isAvailable: row.is_available,
        displayOrder: row.display_order,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      });
      byProduct.set(productId, list);
    }
    return byProduct;
  } catch (err) {
    if (err?.code === '42P01' || err?.message?.includes('relation "product_variations" does not exist')) {
      console.warn('[product_variations] Table missing. Returning empty variation map.');
      return new Map();
    }
    throw err;
  }
};

/**
 * Delete a product variation
 */
const deleteProductVariation = async (variationId) => {
  const result = await query(
    'DELETE FROM product_variations WHERE id = $1 RETURNING *',
    [variationId]
  );

  return result.rows[0] ? {
    id: result.rows[0].id.toString(),
    productId: result.rows[0].product_id.toString(),
    size: result.rows[0].size,
  } : null;
};

module.exports = {
  createProductVariation,
  getProductVariations,
  getVariationsByProductIds,
  updateProductVariation,
  deleteProductVariation,
};

