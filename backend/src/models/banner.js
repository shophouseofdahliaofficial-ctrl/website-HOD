const { query } = require('../config/database');

/**
 * Banner Model
 * Handles all database operations for banners
 */

let bannerColumnsEnsured = false;
const ensureBannerColumns = async () => {
  if (bannerColumnsEnsured) return;
  try {
    await query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS desktop_display_mode VARCHAR(32) NOT NULL DEFAULT 'swipe';`);
    await query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS mobile_display_mode VARCHAR(32) NOT NULL DEFAULT 'swipe';`);
    await query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;`);
    bannerColumnsEnsured = true;
  } catch (err) {
    console.error('[BANNER MODEL] Failed to ensure banner columns:', err);
  }
};

/**
 * Transform banner from database format (snake_case) to API format (camelCase)
 * @param {Object} banner - Banner row from database
 * @returns {Object|null} Transformed banner or null
 */
const transformBanner = (banner) => {
  if (!banner) return null;
  
  let images = [];
  if (banner.images) {
    images = typeof banner.images === 'string' ? JSON.parse(banner.images) : banner.images;
  }
  if (!Array.isArray(images) || images.length === 0) {
    if (banner.image_url) {
      images = [{
        id: 'img_default',
        imageUrl: banner.image_url,
        imagePublicId: banner.image_public_id,
        mobileImageUrl: banner.mobile_image_url || null,
        mobileImagePublicId: banner.mobile_image_public_id || null,
        title: banner.title || '',
        link: banner.link || '',
        linkTarget: banner.link_target || 'same_tab',
      }];
    }
  }

  const primaryImage = images[0] || {};
  
  return {
    id: banner.id,
    title: banner.title,
    description: banner.description,
    imageUrl: banner.image_url || primaryImage.imageUrl || '',
    imagePublicId: banner.image_public_id || primaryImage.imagePublicId,
    mobileImageUrl: banner.mobile_image_url || primaryImage.mobileImageUrl || null,
    mobileImagePublicId: banner.mobile_image_public_id || primaryImage.mobileImagePublicId || null,
    images,
    desktopDisplayMode: banner.desktop_display_mode === 'down' ? 'down' : 'swipe',
    mobileDisplayMode: banner.mobile_display_mode === 'down' ? 'down' : 'swipe',
    link: banner.link, // Optional link URL
    linkTarget: banner.link_target || 'same_tab',
    orderIndex: banner.order_index,
    isActive: banner.is_active,
    adaptToFirstImage: banner.adapt_to_first_image || false,
    createdAt: banner.created_at?.toISOString(),
    updatedAt: banner.updated_at?.toISOString(),
  };
};

/**
 * Create a new banner
 * @param {Object} bannerData - Banner data
 * @returns {Promise<Object>} Created banner (camelCase format)
 */
const createBanner = async (bannerData) => {
  await ensureBannerColumns();
  const { 
    title, 
    description, 
    imageUrl, 
    imagePublicId, 
    mobileImageUrl,
    mobileImagePublicId,
    images = [],
    desktopDisplayMode = 'swipe',
    mobileDisplayMode = 'swipe',
    link,
    linkTarget = 'same_tab',
    orderIndex = 0,
    isActive = true,
    adaptToFirstImage = false
  } = bannerData;

  const imagesJson = typeof images === 'string' ? images : JSON.stringify(images);

  const result = await query(
    `INSERT INTO banners (title, description, image_url, image_public_id, mobile_image_url, mobile_image_public_id, link, link_target, order_index, is_active, adapt_to_first_image, desktop_display_mode, mobile_display_mode, images, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, NOW(), NOW())
     RETURNING *`,
    [
      title,
      description,
      imageUrl,
      imagePublicId,
      mobileImageUrl || null,
      mobileImagePublicId || null,
      link || null,
      linkTarget,
      orderIndex,
      isActive,
      adaptToFirstImage,
      desktopDisplayMode || 'swipe',
      mobileDisplayMode || 'swipe',
      imagesJson
    ]
  );

  return transformBanner(result.rows[0]);
};

/**
 * Get all active banners (for homepage - ordered by order_index)
 * @returns {Promise<Array>} Array of active banners (camelCase format)
 */
const getActiveBanners = async () => {
  await ensureBannerColumns();
  const result = await query(
    'SELECT * FROM banners WHERE is_active = true ORDER BY order_index ASC, created_at DESC'
  );

  return result.rows.map(transformBanner);
};

/**
 * Get all banners (for admin - includes inactive)
 * @returns {Promise<Array>} Array of all banners (camelCase format)
 */
const getAllBanners = async () => {
  await ensureBannerColumns();
  const result = await query(
    'SELECT * FROM banners ORDER BY order_index ASC, created_at DESC'
  );

  return result.rows.map(transformBanner);
};

/**
 * Get banner by ID
 * @param {string} bannerId - Banner ID
 * @returns {Promise<Object|null>} Banner object or null (camelCase format)
 */
const getBannerById = async (bannerId) => {
  await ensureBannerColumns();
  const result = await query(
    'SELECT * FROM banners WHERE id = $1',
    [bannerId]
  );

  return transformBanner(result.rows[0] || null);
};

/**
 * Update banner
 * @param {string} bannerId - Banner ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated banner (camelCase format)
 */
const updateBanner = async (bannerId, updates) => {
  await ensureBannerColumns();
  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updates).forEach((key) => {
    // Map camelCase to snake_case
    const dbKey = key === 'imageUrl' ? 'image_url' :
                  key === 'imagePublicId' ? 'image_public_id' :
                  key === 'mobileImageUrl' ? 'mobile_image_url' :
                  key === 'mobileImagePublicId' ? 'mobile_image_public_id' :
                  key === 'desktopDisplayMode' ? 'desktop_display_mode' :
                  key === 'mobileDisplayMode' ? 'mobile_display_mode' :
                  key === 'linkTarget' ? 'link_target' :
                  key === 'orderIndex' ? 'order_index' :
                  key === 'isActive' ? 'is_active' :
                  key === 'adaptToFirstImage' ? 'adapt_to_first_image' :
                  key === 'images' ? 'images' : key;
    
    if (key === 'images') {
      const imagesVal = typeof updates[key] === 'string' ? updates[key] : JSON.stringify(updates[key]);
      fields.push(`${dbKey} = $${paramCount}::jsonb`);
      values.push(imagesVal);
    } else {
      fields.push(`${dbKey} = $${paramCount}`);
      const value = key === 'link' ? (updates[key] || null) : updates[key];
      values.push(value);
    }
    paramCount++;
  });

  fields.push(`updated_at = NOW()`);
  values.push(bannerId);

  const result = await query(
    `UPDATE banners 
     SET ${fields.join(', ')} 
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  return transformBanner(result.rows[0]);
};

/**
 * Delete banner (hard delete - also deletes image from Cloudinary)
 * @param {string} bannerId - Banner ID
 * @returns {Promise<Object>} Deleted banner (camelCase format)
 */
const deleteBanner = async (bannerId) => {
  const result = await query(
    `DELETE FROM banners 
     WHERE id = $1
     RETURNING *`,
    [bannerId]
  );

  return transformBanner(result.rows[0]);
};

module.exports = {
  createBanner,
  getActiveBanners,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
};



