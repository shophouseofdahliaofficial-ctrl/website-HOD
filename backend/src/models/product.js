const { query, getClient } = require('../config/database');
const { transformProduct } = require('../utils/transform');
let taxColumnEnsured = false;
let maxQuantityColumnEnsured = false;
let deliveryPincodesColumnEnsured = false;
let deliveryTimeTextColumnEnsured = false;
let isNationwideDeliveryColumnEnsured = false;
let accordionItemsColumnEnsured = false;

const ensureTaxColumn = async () => {
  if (taxColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;`);
  taxColumnEnsured = true;
};

const ensureMaxQuantityColumn = async () => {
  if (maxQuantityColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS max_quantity INTEGER NOT NULL DEFAULT 99;`);
  maxQuantityColumnEnsured = true;
};

const ensureDeliveryPincodesColumn = async () => {
  if (deliveryPincodesColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_pincodes JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  deliveryPincodesColumnEnsured = true;
};

const ensureAccordionItemsColumn = async () => {
  if (accordionItemsColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS accordion_items JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  accordionItemsColumnEnsured = true;
};

const ensureDeliveryTimeTextColumn = async () => {
  if (deliveryTimeTextColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_time_text TEXT;`);
  deliveryTimeTextColumnEnsured = true;
};

const ensureIsNationwideDeliveryColumn = async () => {
  if (isNationwideDeliveryColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_nationwide_delivery BOOLEAN NOT NULL DEFAULT false;`);
  isNationwideDeliveryColumnEnsured = true;
};

let isCustomizableColumnEnsured = false;
const ensureIsCustomizableColumn = async () => {
  if (isCustomizableColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_customizable BOOLEAN NOT NULL DEFAULT false;`);
  isCustomizableColumnEnsured = true;
};

let photobookEditorEnabledColumnEnsured = false;
const ensurePhotobookEditorEnabledColumn = async () => {
  if (photobookEditorEnabledColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS photobook_editor_enabled BOOLEAN NOT NULL DEFAULT false;`);
  photobookEditorEnabledColumnEnsured = true;
};

let buyNowEnabledColumnEnsured = false;
const ensureBuyNowEnabledColumn = async () => {
  if (buyNowEnabledColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_now_enabled BOOLEAN NOT NULL DEFAULT true;`);
  buyNowEnabledColumnEnsured = true;
};

let buyAgainEnabledColumnEnsured = false;
const ensureBuyAgainEnabledColumn = async () => {
  if (buyAgainEnabledColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_again_enabled BOOLEAN NOT NULL DEFAULT true;`);
  buyAgainEnabledColumnEnsured = true;
};

let polaroidUploadEnabledColumnEnsured = false;
const ensurePolaroidUploadEnabledColumn = async () => {
  if (polaroidUploadEnabledColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS polaroid_upload_enabled BOOLEAN NOT NULL DEFAULT false;`);
  polaroidUploadEnabledColumnEnsured = true;
};

let stripUploadEnabledColumnEnsured = false;
const ensureStripUploadEnabledColumn = async () => {
  if (stripUploadEnabledColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS strip_upload_enabled BOOLEAN NOT NULL DEFAULT false;`);
  stripUploadEnabledColumnEnsured = true;
};

let customizationOptionsColumnEnsured = false;
const ensureCustomizationOptionsColumn = async () => {
  if (customizationOptionsColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_options JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  customizationOptionsColumnEnsured = true;
};

let customizationCombinationsColumnEnsured = false;
const ensureCustomizationCombinationsColumn = async () => {
  if (customizationCombinationsColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_combinations JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  customizationCombinationsColumnEnsured = true;
};

let detailBannersColumnEnsured = false;
const ensureDetailBannersColumn = async () => {
  if (detailBannersColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_banners JSONB NOT NULL DEFAULT '{"images":[],"adaptToFullImageRatio":false,"displayMode":"stacked"}'::jsonb;`);
  detailBannersColumnEnsured = true;
};

let digitalFlipbookColumnEnsured = false;
const ensureDigitalFlipbookColumn = async () => {
  if (digitalFlipbookColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_flipbook JSONB NOT NULL DEFAULT '{"enabled":false,"sections":[]}'::jsonb;`);
  digitalFlipbookColumnEnsured = true;
};

let weightColumnEnsured = false;
const ensureWeightColumn = async () => {
  if (weightColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3);`);
  weightColumnEnsured = true;
};

let variationWeightColumnEnsured = false;
const ensureVariationWeightColumn = async () => {
  if (variationWeightColumnEnsured) return;
  await query(`ALTER TABLE product_variations ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3);`);
  variationWeightColumnEnsured = true;
};

let hoverNextImageColumnEnsured = false;
const ensureHoverNextImageColumn = async () => {
  if (hoverNextImageColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS hover_next_image BOOLEAN NOT NULL DEFAULT false;`);
  hoverNextImageColumnEnsured = true;
};

let sizeGuideColumnEnsured = false;
const ensureSizeGuideColumn = async () => {
  if (sizeGuideColumnEnsured) return;
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS size_guide JSONB NOT NULL DEFAULT '{"enabled":false,"type":"table","imageUrl":"","tableRows":[]}'::jsonb;`);
  sizeGuideColumnEnsured = true;
};

const ensureProductContentColumns = async () => {
  await ensureDetailBannersColumn();
  await ensureDigitalFlipbookColumn();
  await ensureSizeGuideColumn();
};

let productSchemaEnsured = false;
let productSchemaEnsurePromise = null;

/** Run all product column migrations once per process (not on every API request). */
const ensureAllProductColumns = async () => {
  if (productSchemaEnsured) return;
  if (!productSchemaEnsurePromise) {
    productSchemaEnsurePromise = (async () => {
      await ensureTaxColumn();
      await ensureMaxQuantityColumn();
      await ensureDeliveryPincodesColumn();
      await ensureAccordionItemsColumn();
      await ensureDeliveryTimeTextColumn();
      await ensureIsNationwideDeliveryColumn();
      await ensureIsCustomizableColumn();
      await ensurePhotobookEditorEnabledColumn();
      await ensureBuyNowEnabledColumn();
      await ensureBuyAgainEnabledColumn();
      await ensurePolaroidUploadEnabledColumn();
      await ensureStripUploadEnabledColumn();
      await ensureCustomizationOptionsColumn();
      await ensureCustomizationCombinationsColumn();
      await ensureProductContentColumns();
      await ensureWeightColumn();
      await ensureVariationWeightColumn();
      await ensureHoverNextImageColumn();
      productSchemaEnsured = true;
    })().catch((error) => {
      productSchemaEnsurePromise = null;
      throw error;
    });
  }
  return productSchemaEnsurePromise;
};

/** Columns needed for product cards / list views (excludes heavy detail-only JSONB). */
const PRODUCT_LIST_SELECT = `
  id, name, description, price_per_litre, image_url, quantity, low_stock_threshold, max_quantity,
  category_id, selling_price, compare_at_price, tax_percent, is_active, is_membership_eligible,
  is_nationwide_delivery, delivery_pincodes, delivery_time_text, is_customizable,
  photobook_editor_enabled, buy_now_enabled, buy_again_enabled, polaroid_upload_enabled,
  strip_upload_enabled, customization_options, customization_combinations,
  accordion_items, detail_banners, digital_flipbook,
  hover_next_image,
  created_at, updated_at
`;

/**
 * Product Model
 * Handles all database operations for products
 */

/**
 * Create a new product
 * @param {Object} productData - Product data
 * @returns {Promise<Object>} Created product (camelCase format)
 */
const createProduct = async (productData) => {
  await ensureAllProductColumns();
  const {
    name,
    description,
    pricePerLitre,
    imageUrl,
    isActive = true,
    isMembershipEligible = false,
    quantity = 0,
    lowStockThreshold = 10,
    maxQuantity = 99,
    categoryId = null,
    sellingPrice = null,
    compareAtPrice = null,
    taxPercent = 0,
    isNationwideDelivery = false,
    deliveryPincodes = [],
    deliveryTimeText = null,
    isCustomizable = false,
    photobookEditorEnabled = false,
    buyNowEnabled = true,
    buyAgainEnabled = true,
    polaroidUploadEnabled = false,
    stripUploadEnabled = false,
    accordionItems = [],
    customizationOptions = [],
    customizationCombinations = [],
    detailBanners = { images: [], adaptToFullImageRatio: false, displayMode: 'stacked' },
    digitalFlipbook = { enabled: false, sections: [] },
    sizeGuide = { enabled: false, type: 'table', imageUrl: '', tableRows: [] },
    hoverNextImage = false,
  } = productData;

  const result = await query(
    `INSERT INTO products (
      name, description, price_per_litre, image_url, is_active, 
      is_membership_eligible, quantity, low_stock_threshold, category_id,
      selling_price, compare_at_price, tax_percent, max_quantity, is_nationwide_delivery, delivery_pincodes, delivery_time_text, is_customizable, accordion_items,
      photobook_editor_enabled, buy_now_enabled, buy_again_enabled, polaroid_upload_enabled, strip_upload_enabled,
      customization_options, customization_combinations, detail_banners, digital_flipbook, size_guide, hover_next_image,
      created_at, updated_at
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18::jsonb, $19, $20, $21, $22, $23, $24::jsonb, $25::jsonb, $26::jsonb, $27::jsonb, $28::jsonb, $29, NOW(), NOW())
     RETURNING *`,
     [
      name,
      description,
      pricePerLitre,
      imageUrl,
      isActive,
      isMembershipEligible,
      quantity,
      lowStockThreshold,
      categoryId,
      sellingPrice,
      compareAtPrice,
      taxPercent,
      maxQuantity,
      isNationwideDelivery,
      JSON.stringify(Array.isArray(deliveryPincodes) ? deliveryPincodes : []),
      deliveryTimeText,
      isCustomizable,
      JSON.stringify(Array.isArray(accordionItems) ? accordionItems : []),
      photobookEditorEnabled,
      buyNowEnabled,
      buyAgainEnabled,
      polaroidUploadEnabled,
      stripUploadEnabled,
      JSON.stringify(Array.isArray(customizationOptions) ? customizationOptions : []),
      JSON.stringify(Array.isArray(customizationCombinations) ? customizationCombinations : []),
      JSON.stringify(detailBanners != null ? detailBanners : { images: [], adaptToFullImageRatio: false, displayMode: 'stacked' }),
      JSON.stringify(digitalFlipbook != null ? digitalFlipbook : { enabled: false, sections: [] }),
      JSON.stringify(sizeGuide != null ? sizeGuide : { enabled: false, type: 'table', imageUrl: '', tableRows: [] }),
      hoverNextImage,
     ]
  );

  return transformProduct(result.rows[0]);
};

const getActiveProductsForList = async () => {
  await ensureAllProductColumns();
  const result = await query(
    `SELECT ${PRODUCT_LIST_SELECT} FROM products WHERE is_active = true ORDER BY created_at DESC`
  );

  return result.rows.map(transformProduct);
};

/**
 * Get all active products (for customers)
 * @returns {Promise<Array>} Array of active products (camelCase format)
 */
const getActiveProducts = async () => getActiveProductsForList();

/**
 * Get all products (for admin - includes inactive)
 * @returns {Promise<Array>} Array of all products (camelCase format)
 */
const getAllProducts = async () => {
  await ensureAllProductColumns();
  const result = await query(
    'SELECT * FROM products ORDER BY created_at DESC'
  );

  return result.rows.map(transformProduct);
};

/**
 * Get product by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object|null>} Product object or null (camelCase format)
 */
const getProductById = async (productId) => {
  await ensureAllProductColumns();
  const result = await query(
    'SELECT * FROM products WHERE id = $1',
    [productId]
  );

  return transformProduct(result.rows[0] || null);
};

/**
 * Update product
 * @param {string} productId - Product ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated product (camelCase format)
 */
const updateProduct = async (productId, updates) => {
  await ensureAllProductColumns();
  if ('deliveryPincodeConfigs' in updates && !('deliveryPincodes' in updates)) {
    updates = { ...updates, deliveryPincodes: updates.deliveryPincodeConfigs };
    const { deliveryPincodeConfigs: _dropped, ...rest } = updates;
    updates = rest;
  }

  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updates).forEach((key) => {
    // Map camelCase to snake_case
    const dbKey = key === 'pricePerLitre' ? 'price_per_litre' :
      key === 'imageUrl' ? 'image_url' :
        key === 'isActive' ? 'is_active' :
          key === 'isMembershipEligible' ? 'is_membership_eligible' :
            key === 'lowStockThreshold' ? 'low_stock_threshold' :
              key === 'maxQuantity' ? 'max_quantity' :
                key === 'categoryId' ? 'category_id' :
                  key === 'sellingPrice' ? 'selling_price' :
                      key === 'compareAtPrice' ? 'compare_at_price' :
                        key === 'taxPercent' ? 'tax_percent' :
                          key === 'isNationwideDelivery' ? 'is_nationwide_delivery' :
                            key === 'deliveryPincodes' ? 'delivery_pincodes' :
                              key === 'isCustomizable' ? 'is_customizable' :
                                key === 'photobookEditorEnabled' ? 'photobook_editor_enabled' :
                                  key === 'buyNowEnabled' ? 'buy_now_enabled' :
                                    key === 'buyAgainEnabled' ? 'buy_again_enabled' :
                                      key === 'polaroidUploadEnabled' ? 'polaroid_upload_enabled' :
                                        key === 'stripUploadEnabled' ? 'strip_upload_enabled' :
                                          key === 'accordionItems' ? 'accordion_items' :
                                      key === 'customizationOptions' ? 'customization_options' :
                                      key === 'customizationCombinations' ? 'customization_combinations' :
                                        key === 'detailBanners' ? 'detail_banners' :
                                          key === 'digitalFlipbook' ? 'digital_flipbook' :
                                            key === 'sizeGuide' ? 'size_guide' :
                                        key === 'deliveryTimeText' ? 'delivery_time_text' :
                                          key === 'hoverNextImage' ? 'hover_next_image' : key;

    const isJsonb = key === 'deliveryPincodes' || key === 'accordionItems' || key === 'customizationOptions' || key === 'customizationCombinations' || key === 'detailBanners' || key === 'digitalFlipbook' || key === 'sizeGuide';
    fields.push(isJsonb ? `${dbKey} = $${paramCount}::jsonb` : `${dbKey} = $${paramCount}`);
    if (isJsonb) {
      let jsonVal = updates[key];
      if (typeof jsonVal === 'string') {
        try {
          jsonVal = JSON.parse(jsonVal);
        } catch (_) {}
      }
      values.push(JSON.stringify(jsonVal != null ? jsonVal : (key === 'detailBanners' || key === 'digitalFlipbook' || key === 'sizeGuide' ? {} : [])));
    } else {
      values.push(updates[key]);
    }
    paramCount++;
  });

  fields.push(`updated_at = NOW()`);
  values.push(productId);

  const result = await query(
    `UPDATE products 
     SET ${fields.join(', ')} 
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  return transformProduct(result.rows[0]);
};

/**
 * Delete product permanently and clean dependent rows.
 * Note: subscriptions.product_id is ON DELETE RESTRICT, so we remove those rows first.
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Deleted product (camelCase format)
 */
const deleteProduct = async (productId) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Remove subscriptions for this product first (RESTRICT FK on subscriptions.product_id).
    await client.query(
      `DELETE FROM subscriptions
       WHERE product_id = $1`,
      [productId]
    );

    // Remove product row; related rows with ON DELETE CASCADE are deleted automatically.
    const result = await client.query(
      `DELETE FROM products
       WHERE id = $1
       RETURNING *`,
      [productId]
    );

    await client.query('COMMIT');
    return transformProduct(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  ensureAllProductColumns,
  ensureDeliveryPincodesColumn,
  ensureDeliveryTimeTextColumn,
  ensureIsNationwideDeliveryColumn,
  createProduct,
  getActiveProducts,
  getActiveProductsForList,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
