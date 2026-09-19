const { query } = require('../config/database');

let productReviewsSchemaEnsured = false;

async function ensureProductReviewsSchema() {
  if (productReviewsSchemaEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      user_id UUID,
      reviewer_name VARCHAR(255) NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      is_approved BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);`);
  productReviewsSchemaEnsured = true;
}

/**
 * Product Review Model
 * Handles database operations for product reviews
 */

/**
 * Create a new product review
 */
const createProductReview = async (productId, reviewData) => {
  await ensureProductReviewsSchema();
  const { userId, reviewerName, rating, comment, isApproved = true } = reviewData;

  const result = await query(
    `INSERT INTO product_reviews (product_id, user_id, reviewer_name, rating, comment, is_approved, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [productId, userId || null, reviewerName, rating, comment || null, isApproved]
  );

  return {
    id: result.rows[0].id.toString(),
    productId: result.rows[0].product_id.toString(),
    userId: result.rows[0].user_id ? result.rows[0].user_id.toString() : null,
    reviewerName: result.rows[0].reviewer_name,
    rating: result.rows[0].rating,
    comment: result.rows[0].comment,
    isApproved: result.rows[0].is_approved,
    createdAt: result.rows[0].created_at.toISOString(),
    updatedAt: result.rows[0].updated_at.toISOString(),
  };
};

/**
 * Get all approved reviews for a product
 */
const getProductReviews = async (productId, includeUnapproved = false) => {
  try {
    let queryStr = `SELECT pr.*, u.name as user_name, u.email as user_email
                    FROM product_reviews pr
                    LEFT JOIN users u ON pr.user_id = u.id
                    WHERE pr.product_id = $1`;
    
    if (!includeUnapproved) {
      queryStr += ' AND pr.is_approved = true';
    }
    
    queryStr += ' ORDER BY pr.created_at DESC';

    const result = await query(queryStr, [productId]);

    return result.rows.map(row => ({
      id: row.id.toString(),
      productId: row.product_id.toString(),
      userId: row.user_id ? row.user_id.toString() : null,
      reviewerName: row.reviewer_name,
      rating: row.rating,
      comment: row.comment,
      isApproved: row.is_approved,
      userName: row.user_name,
      userEmail: row.user_email,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  } catch (err) {
    if (err?.code === '42P01' || err?.message?.includes('relation "product_reviews" does not exist')) {
      console.warn('[product_reviews] Table missing (migration not applied). Returning empty reviews array.');
      return [];
    }
    throw err;
  }
};

/**
 * Average rating + count for many products (list/card views).
 * @returns {Promise<Map<string, { averageRating: number, count: number }>>}
 */
const getReviewSummariesByProductIds = async (productIds = []) => {
  await ensureProductReviewsSchema();
  const ids = productIds
    .map((id) => parseInt(String(id), 10))
    .filter((id) => Number.isFinite(id));
  if (ids.length === 0) return new Map();

  try {
    const result = await query(
      `SELECT product_id,
              COUNT(*)::int AS review_count,
              ROUND(AVG(rating)::numeric, 2) AS average_rating
       FROM product_reviews
       WHERE product_id = ANY($1::int[])
         AND is_approved = true
       GROUP BY product_id`,
      [ids]
    );

    const summaries = new Map();
    for (const row of result.rows) {
      summaries.set(String(row.product_id), {
        averageRating: row.average_rating != null ? parseFloat(row.average_rating) : 0,
        count: parseInt(row.review_count || 0, 10),
      });
    }
    return summaries;
  } catch (err) {
    if (err?.code === '42P01' || err?.message?.includes('relation "product_reviews" does not exist')) {
      console.warn('[product_reviews] Table missing. Returning empty review summary map.');
      return new Map();
    }
    throw err;
  }
};

/**
 * Update a product review (admin only)
 */
const updateProductReview = async (reviewId, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updates).forEach((key) => {
    const dbKey = key === 'isApproved' ? 'is_approved' :
                  key === 'reviewerName' ? 'reviewer_name' : key;
    
    fields.push(`${dbKey} = $${paramCount}`);
    values.push(updates[key]);
    paramCount++;
  });

  fields.push(`updated_at = NOW()`);
  values.push(reviewId);

  const result = await query(
    `UPDATE product_reviews 
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
    userId: row.user_id ? row.user_id.toString() : null,
    reviewerName: row.reviewer_name,
    rating: row.rating,
    comment: row.comment,
    isApproved: row.is_approved,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
};

/**
 * Delete a product review
 */
const deleteProductReview = async (reviewId) => {
  const result = await query(
    'DELETE FROM product_reviews WHERE id = $1 RETURNING *',
    [reviewId]
  );

  return result.rows[0] ? {
    id: result.rows[0].id.toString(),
    productId: result.rows[0].product_id.toString(),
  } : null;
};

module.exports = {
  createProductReview,
  getProductReviews,
  getReviewSummariesByProductIds,
  updateProductReview,
  deleteProductReview,
};

