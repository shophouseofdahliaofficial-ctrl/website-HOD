const productService = require('../services/productService');
const productModel = require('../models/product');
const productImageModel = require('../models/productImage');
const productVariationModel = require('../models/productVariation');
const productReviewModel = require('../models/productReview');
const bannerService = require('../services/bannerService');
const userModel = require('../models/user');
const subscriptionModel = require('../models/subscription');
const subscriptionService = require('../services/subscriptionService');
const siteContentModel = require('../models/siteContent');
const categoryService = require('../services/categoryService');
const couponModel = require('../models/coupon');
const couponService = require('../services/couponService');
const { uploadImage, deleteImage, listMediaResources } = require('../config/cloudinary');
const { query } = require('../config/database');
const { ValidationError } = require('../utils/errors');
const { transformDeliverySchedule, pgDateOnlyToYmd } = require('../utils/transform');
const orderModel = require('../models/order');
const cartAnalytics = require('../models/cartAnalytics');
const { assertProductsDeliverableToPostalCode } = require('../services/productDeliverabilityService');
const { getPlatformFeeAmount, roundMoney } = require('../services/pricingService');
const adminPushService = require('../services/adminPushNotificationService');
const walletService = require('../services/walletService');
const crypto = require('crypto');

/**
 * Admin Controller
 * Handles admin HTTP requests
 */

// ========== Products ==========

/**
 * Get all products (admin view)
 * GET /api/admin/products
 */
const getAllProducts = async (req, res, next) => {
  try {
    const products = await productService.getAllProducts();

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create product
 * POST /api/admin/products
 */
const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body, req.file);

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product
 * PUT /api/admin/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productService.updateProduct(id, req.body, req.file);

    res.json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product by ID with details
 * GET /api/admin/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id, true);

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product
 * DELETE /api/admin/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await productService.deleteProduct(id);

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Product Images ==========

/**
 * Add product image
 * POST /api/admin/products/:id/images
 */
const addProductImage = async (req, res, next) => {
  try {
    const { id } = req.params;

    let imageUrl = req.body?.imageUrl || null;

    if (req.file) {
      const uploadResult = await uploadImage(req.file.buffer, {
        resource_type: 'image',
        folder: 'houseofdahlia/products',
      });
      imageUrl = uploadResult.url;
    }

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Image file or imageUrl is required',
      });
    }

    const maxOrder = await productImageModel.getMaxDisplayOrder(id);
    const displayOrder = maxOrder + 1;
    const image = await productImageModel.createProductImage(id, imageUrl, displayOrder);
    const product = await productModel.getProductById(id);

    if (product && !product.imageUrl) {
      await productModel.updateProduct(id, { imageUrl });
    }

    res.status(201).json({
      success: true,
      data: image,
      message: 'Image added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a detail-page asset image (banners, flipbook pages)
 * POST /api/admin/products/:id/detail-assets
 */
const uploadProductDetailAsset = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required',
      });
    }

    const product = await productModel.getProductById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const uploadResult = await uploadImage(req.file.buffer, {
      resource_type: 'image',
      folder: `houseofdahlia/products/${id}/detail-assets`,
    });

    res.status(201).json({
      success: true,
      data: { imageUrl: uploadResult.url },
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a customization option/combination image for an existing product.
 * POST /api/admin/products/:id/customization-assets
 */
const uploadProductCustomizationAsset = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required',
      });
    }

    const product = await productModel.getProductById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const uploadResult = await uploadImage(req.file.buffer, {
      resource_type: 'image',
      folder: `houseofdahlia/products/${id}/customization`,
    });

    res.status(201).json({
      success: true,
      data: { imageUrl: uploadResult.url },
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a customization image before a product exists (new product form).
 * POST /api/admin/products/customization-assets
 */
const uploadPendingCustomizationAsset = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required',
      });
    }

    const uploadResult = await uploadImage(req.file.buffer, {
      resource_type: 'image',
      folder: 'houseofdahlia/customization-assets',
    });

    res.status(201).json({
      success: true,
      data: { imageUrl: uploadResult.url },
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product image
 * DELETE /api/admin/products/:id/images/:imageId
 */
const deleteProductImage = async (req, res, next) => {
  try {
    const { id: productId, imageId } = req.params;
    const image = await productImageModel.deleteProductImage(imageId);

    if (image) {
      try {
        const urlParts = image.imageUrl.split('/');
        const publicId = urlParts.slice(-2).join('/').split('.')[0];
        await deleteImage(`houseofdahlia/products/${publicId}`);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }

      const product = await productModel.getProductById(productId);
      if (product && product.imageUrl === image.imageUrl) {
        const remaining = await productImageModel.getProductImages(productId);
        const sorted = [...remaining].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        const nextUrl = sorted[0]?.imageUrl ?? null;
        await productModel.updateProduct(productId, { imageUrl: nextUrl });
      }
    }

    res.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reorder product images (gallery + primary). First URL becomes products.image_url (cover).
 * PUT /api/admin/products/:id/images/reorder
 * Body: { orderedUrls: string[] }
 */
const reorderProductImages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orderedUrls } = req.body || {};

    if (!Array.isArray(orderedUrls) || orderedUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'orderedUrls must be a non-empty array of image URLs',
      });
    }

    const product = await productService.getProductById(id, true);
    const allowedSet = new Set();
    if (product.imageUrl) allowedSet.add(product.imageUrl);
    for (const r of product.images || []) {
      allowedSet.add(r.imageUrl);
    }

    if (new Set(orderedUrls).size !== orderedUrls.length) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate URLs are not allowed in orderedUrls',
      });
    }
    if (orderedUrls.length !== allowedSet.size) {
      return res.status(400).json({
        success: false,
        error: 'orderedUrls must list every product image exactly once',
      });
    }
    for (const u of orderedUrls) {
      if (!allowedSet.has(u)) {
        return res.status(400).json({
          success: false,
          error: 'orderedUrls contains an unknown image URL',
        });
      }
    }

    await productModel.updateProduct(id, { imageUrl: orderedUrls[0] });
    await productImageModel.applyDisplayOrderByUrls(id, orderedUrls);

    const updated = await productService.getProductById(id, true);
    res.json({
      success: true,
      data: updated,
      message: 'Image order updated',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Product Variations ==========

/**
 * Add product variation
 * POST /api/admin/products/:id/variations
 */
const addProductVariation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      size,
      priceMultiplier = 1.0,
      price = null,
      compareAtPrice = null,
      isAvailable = true,
      displayOrder = 0,
    } = req.body;

    if (!size) {
      return res.status(400).json({
        success: false,
        error: 'Size is required',
      });
    }

    let compareParsed = null;
    if (compareAtPrice !== null && compareAtPrice !== undefined && String(compareAtPrice).trim() !== '') {
      const c = parseFloat(compareAtPrice);
      if (Number.isFinite(c)) compareParsed = c;
    }

    const variation = await productVariationModel.createProductVariation(
      id,
      size,
      priceMultiplier,
      isAvailable,
      displayOrder,
      price ? parseFloat(price) : null,
      compareParsed
    );

    await productService.applyVariationModePricing(id);

    res.status(201).json({
      success: true,
      data: variation,
      message: 'Variation added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product variation
 * PUT /api/admin/products/:id/variations/:variationId
 */
const updateProductVariation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { variationId } = req.params;
    const b = req.body || {};
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(b, 'size')) updates.size = b.size;
    if (Object.prototype.hasOwnProperty.call(b, 'price')) updates.price = b.price;
    if (Object.prototype.hasOwnProperty.call(b, 'priceMultiplier')) updates.priceMultiplier = b.priceMultiplier;
    if (Object.prototype.hasOwnProperty.call(b, 'compareAtPrice')) updates.compareAtPrice = b.compareAtPrice;
    else if (Object.prototype.hasOwnProperty.call(b, 'compare_at_price')) {
      updates.compareAtPrice = b.compare_at_price;
    }
    if (Object.prototype.hasOwnProperty.call(b, 'weight')) updates.weight = b.weight;
    if (Object.prototype.hasOwnProperty.call(b, 'isAvailable')) updates.isAvailable = b.isAvailable;
    else if (Object.prototype.hasOwnProperty.call(b, 'is_available')) updates.isAvailable = b.is_available;
    if (Object.prototype.hasOwnProperty.call(b, 'displayOrder')) updates.displayOrder = b.displayOrder;
    else if (Object.prototype.hasOwnProperty.call(b, 'display_order')) updates.displayOrder = b.display_order;

    const variation = await productVariationModel.updateProductVariation(variationId, updates);

    await productService.applyVariationModePricing(id);

    res.json({
      success: true,
      data: variation,
      message: 'Variation updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product variation
 * DELETE /api/admin/products/:id/variations/:variationId
 */
const deleteProductVariation = async (req, res, next) => {
  try {
    const { variationId } = req.params;
    const deleted = await productVariationModel.deleteProductVariation(variationId);

    if (deleted?.productId) {
      const remaining = await productVariationModel.getProductVariations(deleted.productId);
      if (remaining.length > 0) {
        await productService.applyVariationModePricing(deleted.productId);
      }
    }

    res.json({
      success: true,
      message: 'Variation deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Product Reviews ==========

/**
 * Add product review (admin can add reviews)
 * POST /api/admin/products/:id/reviews
 */
const addProductReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewerName, rating, comment, isApproved = true } = req.body;

    if (!reviewerName || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Reviewer name and rating are required',
      });
    }

    const review = await productReviewModel.createProductReview(id, {
      userId: null,
      reviewerName,
      rating,
      comment,
      isApproved,
    });

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product review
 * PUT /api/admin/products/:id/reviews/:reviewId
 */
const updateProductReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const review = await productReviewModel.updateProductReview(reviewId, req.body);

    res.json({
      success: true,
      data: review,
      message: 'Review updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product review
 * DELETE /api/admin/products/:id/reviews/:reviewId
 */
const deleteProductReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    await productReviewModel.deleteProductReview(reviewId);

    res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Users ==========

/**
 * Get all users
 * GET /api/admin/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await userModel.getAllUsers();

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 * GET /api/admin/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// ========== Orders & Customers ==========

/**
 * Get all paid orders (admin view)
 * GET /api/admin/orders
 *
 * Merges: (1) subscription orders from payments table, (2) checkout orders from orders table.
 * If the payments table does not exist, only checkout orders are returned.
 */
const getAllOrders = async (req, res, next) => {
  try {
    let orders = [];
    try {
      const result = await query(
        `
        SELECT
          pmt.id AS order_id,
          pmt.razorpay_order_id,
          pmt.razorpay_payment_id,
          pmt.amount,
          pmt.currency,
          pmt.status AS payment_status,
          COALESCE(pmt.paid_at, pmt.created_at) AS ordered_at,
          s.id AS subscription_id,
          u.id AS user_id,
          u.name AS user_name,
          u.email AS user_email,
          (
            SELECT COUNT(*)
            FROM delivery_schedules ds
            WHERE ds.subscription_id = s.id
          ) AS items_count,
          COALESCE(
            (
              SELECT ds.status
              FROM delivery_schedules ds
              WHERE ds.subscription_id = s.id
                AND ds.delivery_date >= CURRENT_DATE
              ORDER BY ds.delivery_date ASC
              LIMIT 1
            ),
            (
              SELECT ds.status
              FROM delivery_schedules ds
              WHERE ds.subscription_id = s.id
              ORDER BY ds.delivery_date DESC
              LIMIT 1
            )
          ) AS delivery_status
        FROM payments pmt
        JOIN subscriptions s ON s.id = pmt.subscription_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE pmt.status = 'captured'
          AND (s.is_trial IS NOT TRUE)
        ORDER BY COALESCE(pmt.paid_at, pmt.created_at) DESC
        `
      );
      orders = result.rows.map((row) => ({
        orderId: String(row.order_id),
        orderNumber: String(row.order_id),
        razorpayOrderId: row.razorpay_order_id,
        razorpayPaymentId: row.razorpay_payment_id,
        orderedAt: row.ordered_at ? new Date(row.ordered_at).toISOString() : null,
        customerName: row.user_name || null,
        customerEmail: row.user_email || null,
        amount: row.amount !== null ? parseFloat(row.amount) : null,
        currency: row.currency || 'INR',
        paymentMethod: 'online',
        paymentStatus: row.payment_status,
        itemsCount: row.items_count !== null ? parseInt(row.items_count, 10) : 0,
        deliveryStatus: row.delivery_status || 'pending',
        subscriptionId: row.subscription_id !== null ? String(row.subscription_id) : null,
        customerId: row.user_id || null,
      }));
    } catch (e) {
      // payments or subscriptions table may not exist (e.g. fresh DB without full schema)
      if (!e.message?.includes('does not exist')) throw e;
    }

    // Also include cart/checkout orders (e.g. COD, online)
    let checkoutOrders = [];
    try {
      checkoutOrders = await orderModel.listAllOrdersAdmin();
    } catch (e) {
      // If the orders tables don't exist yet, keep admin orders working for subscriptions.
      checkoutOrders = [];
    }

    const merged = [...checkoutOrders, ...orders].sort((a, b) => {
      const ta = a.orderedAt ? new Date(a.orderedAt).getTime() : 0;
      const tb = b.orderedAt ? new Date(b.orderedAt).getTime() : 0;
      return tb - ta;
    });

    res.json({ success: true, data: merged });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order details by ID (admin)
 * GET /api/admin/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await orderModel.getOrderByIdForAdmin(id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark order as package prepared
 * POST /api/admin/orders/:id/mark-package-prepared
 */
const markOrderAsPackagePrepared = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Update order status
    await orderModel.markAsPackagePrepared(id);

    // TODO: Create delivery entry in deliveries table
    // This will be implemented when we have the deliveries schema ready

    res.json({
      success: true,
      message: 'Order marked as package prepared successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List checkout order-deliveries (admin deliveries view)
 * GET /api/admin/order-deliveries
 */
const listOrderDeliveries = async (req, res, next) => {
  try {
    const rows = await orderModel.listOrderDeliveriesAdmin();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

/**
 * List out-for-delivery orders as route planner stops
 * GET /api/admin/order-delivery-stops
 */
const listOutForDeliveryStops = async (req, res, next) => {
  try {
    const stops = await orderModel.listOutForDeliveryStops();
    res.json({ success: true, data: stops });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark order as out for delivery
 * POST /api/admin/orders/:id/mark-out-for-delivery
 */
const markOrderAsOutForDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    await orderModel.markAsOutForDelivery(id);
    res.json({ success: true, message: 'Order marked as out for delivery' });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark order as delivered
 * POST /api/admin/orders/:id/mark-delivered
 */
const markOrderAsDelivered = async (req, res, next) => {
  try {
    const { id } = req.params;
    await orderModel.markAsDelivered(id);
    await subscriptionService.activateSubscriptionForCheckoutOrderIfPending(id);
    await subscriptionService.activateTrialSubscriptionsForTrialOrderIfPending(id);
    res.json({ success: true, message: 'Order marked as delivered' });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark order as fulfilled (COD collection / final step)
 * POST /api/admin/orders/:id/mark-fulfilled
 */
const markOrderAsFulfilled = async (req, res, next) => {
  try {
    const { id } = req.params;
    await orderModel.markAsFulfilled(id);
    res.json({ success: true, message: 'Order marked as fulfilled' });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer analytics (admin view)
 * GET /api/admin/customers
 *
 * Returns customers with ordersCount and amountSpent.
 * Uses payments (subscriptions) when available; falls back to orders (checkout) if payments does not exist.
 */
const getCustomerStats = async (req, res, next) => {
  try {
    await userModel.ensureUsersSchema();
    await walletService.ensureWalletSchema();
    let result;
    try {
      result = await query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.phone,
          u.date_of_birth,
          u.wedding_date,
          COALESCE(u.wallet_balance, 0) AS wallet_balance,
          (
            COALESCE(sub_pay.payment_events, 0)
            + COALESCE(chk.checkout_orders, 0)
          ) AS orders_count,
          (
            COALESCE(sub_pay.amount_spent, 0)
            + COALESCE(chk.checkout_spent, 0)
          ) AS amount_spent
        FROM users u
        LEFT JOIN (
          SELECT
            s.user_id,
            COUNT(pmt.id) AS payment_events,
            COALESCE(SUM(pmt.amount), 0) AS amount_spent
          FROM payments pmt
          INNER JOIN subscriptions s ON s.id = pmt.subscription_id
          WHERE pmt.status = 'captured'
          GROUP BY s.user_id
        ) sub_pay ON sub_pay.user_id = u.id
        LEFT JOIN (
          SELECT
            o.user_id,
            COUNT(o.id) AS checkout_orders,
            COALESCE(SUM(o.total), 0) AS checkout_spent
          FROM orders o
          WHERE o.payment_status IN ('paid', 'cod')
          GROUP BY o.user_id
        ) chk ON chk.user_id = u.id
        WHERE LOWER(u.role) = 'customer'
        ORDER BY amount_spent DESC, orders_count DESC, u.created_at DESC
        `
      );
    } catch (e) {
      if (e.message?.includes('does not exist')) {
        // Fallback: use orders table only (checkout orders; payments table missing)
        result = await query(
          `
          SELECT
            u.id,
            u.name,
            u.email,
            u.phone,
            u.date_of_birth,
            u.wedding_date,
            COALESCE(u.wallet_balance, 0) AS wallet_balance,
            COALESCE(COUNT(o.id), 0) AS orders_count,
            COALESCE(SUM(o.total), 0) AS amount_spent
          FROM users u
          LEFT JOIN orders o ON o.user_id = u.id AND o.payment_status IN ('paid', 'cod')
          WHERE LOWER(u.role) = 'customer'
          GROUP BY u.id, u.name, u.email, u.phone, u.date_of_birth, u.wedding_date, u.wallet_balance
          ORDER BY amount_spent DESC, orders_count DESC
          `
        );
      } else {
        throw e;
      }
    }

    const customers = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || undefined,
      dateOfBirth: pgDateOnlyToYmd(row.date_of_birth),
      weddingDate: pgDateOnlyToYmd(row.wedding_date),
      orders: row.orders_count != null ? parseInt(row.orders_count, 10) : 0,
      amountSpent: row.amount_spent != null ? parseFloat(row.amount_spent) : 0,
      walletBalance: row.wallet_balance != null ? parseFloat(row.wallet_balance) : 0,
    }));

    res.json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/customers/:id/wallet
 * Adjust a customer wallet balance by a positive delta.
 */
const updateCustomerWalletBalance = async (req, res, next) => {
  try {
    await walletService.ensureWalletSchema();

    const userId = String(req.params.id || '').trim();
    const operation = String(req.body?.operation || '').trim().toLowerCase();
    const amountInput = Number(req.body?.amount);
    const amount = Math.round(amountInput * 100) / 100;

    if (!userId) throw new ValidationError('Customer id is required');
    if (operation !== 'add' && operation !== 'less') throw new ValidationError('Operation must be add or less');
    if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError('Amount must be greater than 0');

    const { getClient } = require('../config/database');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(
        `SELECT id, role, wallet_balance FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      if (userRes.rows.length === 0) throw new ValidationError('Customer not found');

      const user = userRes.rows[0];
      if (String(user.role || '').toLowerCase() !== 'customer') {
        throw new ValidationError('Wallet can only be edited for customers');
      }

      const currentBalance = parseFloat(user.wallet_balance || 0);
      if (operation === 'less') {
        if (currentBalance <= 0) throw new ValidationError('Cannot subtract when current balance is 0');
        if (amount > currentBalance + 1e-9) throw new ValidationError('Cannot make wallet balance negative');
      }

      const nextBalance =
        operation === 'add'
          ? Math.round((currentBalance + amount) * 100) / 100
          : Math.round((currentBalance - amount) * 100) / 100;

      const updateRes = await client.query(
        `UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2 RETURNING wallet_balance`,
        [nextBalance, userId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          userId,
          previousBalance: currentBalance,
          walletBalance: parseFloat(updateRes.rows[0].wallet_balance || 0),
          operation,
          amount,
        },
        message: 'Wallet balance updated successfully',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get feedback stats (emoji counts and percentages)
 * GET /api/admin/feedback
 */
const getFeedback = async (req, res, next) => {
  try {
    const photobookEditorFeedbackModel = require('../models/photobookEditorFeedback');
    const generalFeedbackModel = require('../models/generalFeedback');
    const [stats, photobookEditor, general] = await Promise.all([
      orderModel.getFeedbackStats(),
      photobookEditorFeedbackModel.getAdminFeedbackData(),
      generalFeedbackModel.getGeneralFeedbackList(),
    ]);
    res.json({ success: true, data: { ...stats, photobookEditor, general } });
  } catch (error) {
    next(error);
  }
};

// ========== Subscriptions ==========

/**
 * Get all subscriptions
 * GET /api/admin/subscriptions
 */
const getAllSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await subscriptionModel.getAllSubscriptions();

    res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get one subscription with delivery schedules (admin)
 * GET /api/admin/subscriptions/:id
 */
const getSubscriptionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionModel.getSubscriptionById(id);
    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause subscription (admin)
 * POST /api/admin/subscriptions/:id/pause
 */
const pauseSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.pauseSubscription(id, null); // Admin bypass

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription paused',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resume subscription (admin)
 * POST /api/admin/subscriptions/:id/resume
 */
const resumeSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.resumeSubscription(id, null); // Admin bypass

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription resumed',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Deliveries ==========

/**
 * Get delivery schedule
 * GET /api/admin/deliveries?date=YYYY-MM-DD
 */
const getDeliveries = async (req, res, next) => {
  try {
    await subscriptionModel.ensureSubscriptionSchema();
    const { date } = req.query;
    const deliveryDate = date
      || (
        await query(`SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date::text AS ymd`)
      ).rows[0]?.ymd;

    const result = await query(
      `SELECT ds.*, s.user_id, s.litres_per_day, s.delivery_time, s.product_id,
              s.status AS subscription_status,
              s.is_trial, s.payment_method,
              s.checkout_order_id, s.trial_checkout_order_id,
              s.trial_shifted,
              s.first_day_shift_applied AS sub_first_day_shift_applied,
              s.frequency, s.duration_days, s.start_date,
              p.name as product_name, u.name as user_name, u.email as user_email,
              pv.size as product_variation_size,
              co_pay.payment_method AS checkout_order_payment_method
       FROM delivery_schedules ds
       LEFT JOIN subscriptions s ON ds.subscription_id = s.id
       LEFT JOIN products p ON s.product_id = p.id
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN product_variations pv ON s.product_variation_id = pv.id
       LEFT JOIN orders co_pay ON co_pay.id = s.checkout_order_id AND co_pay.user_id = s.user_id
       WHERE ds.delivery_date = $1
         AND (
           s.id IS NULL
           OR s.status = 'active'
           OR (s.status = 'pending' AND s.is_trial IS TRUE)
           OR (s.status = 'pending' AND s.checkout_order_id IS NOT NULL)
         )
         AND NOT (
           s.id IS NOT NULL
           AND s.first_day_shift_applied IS TRUE
           AND ds.delivery_date = s.start_date
         )
       ORDER BY COALESCE(s.delivery_time, '23:59'), ds.id`,
      [deliveryDate]
    );

    const transformed = result.rows.map(transformDeliverySchedule).filter((ds) => {
      if (!ds || !ds.subscriptionId) return true;
      if (!ds.startDate || !ds.deliveryDate) return true;

      // Calculate day offset
      const d1 = new Date(ds.startDate + 'T00:00:00Z');
      const d2 = new Date(ds.deliveryDate + 'T00:00:00Z');
      const diffMs = d2.getTime() - d1.getTime();
      const offsetDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Calculate number of scheduled deliveries N
      const durationDays = ds.durationDays || 30;
      let step = 1;
      if (ds.frequency === 'alternate') step = 2;
      else if (ds.frequency === 'weekly') step = 7;
      else if (ds.frequency === 'monthly') step = 30;

      const N = Math.max(1, Math.floor((durationDays - 1) / step) + 1);

      // A day is scheduled if: offset % step === 0 AND index is < N
      const isScheduled = (offsetDays % step === 0) && (offsetDays / step >= 0) && (offsetDays / step < N);
      return isScheduled;
    });

    res.json({
      success: true,
      data: transformed,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update delivery status
 * PUT /api/admin/deliveries/:id
 */
const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'delivered', 'skipped', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const subscriptionModel = require('../models/subscription');
    await subscriptionModel.ensureSubscriptionSchema();
    const { getClient } = require('../config/database');

    const client = await getClient();
    let result;
    let prevScheduleStatus;
    let subscriptionIdForHook;
    try {
      await client.query('BEGIN');
      const current = await client.query(`SELECT id, subscription_id, status FROM delivery_schedules WHERE id = $1 FOR UPDATE`, [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Delivery not found',
        });
      }

      const prevStatus = current.rows[0].status;
      const subscriptionId = current.rows[0].subscription_id;
      prevScheduleStatus = prevStatus;
      subscriptionIdForHook = subscriptionId;

      result = await client.query(
        `UPDATE delivery_schedules 
         SET status = $1,
             delivered_at = CASE WHEN $3 THEN NOW() ELSE delivered_at END,
             updated_at = NOW() 
         WHERE id = $2
         RETURNING *`,
        [status, id, status === 'delivered']
      );

      if (subscriptionId) {
        const subRes = await client.query(`SELECT litres_per_day FROM subscriptions WHERE id = $1 FOR UPDATE`, [subscriptionId]);
        if (subRes.rows.length > 0) {
          const delta = parseFloat(subRes.rows[0].litres_per_day || 0);

          if (prevStatus !== 'delivered' && status === 'delivered') {
            await client.query(
              `
              UPDATE subscriptions
              SET delivered_qty = delivered_qty + $1,
                  remaining_qty = GREATEST(0, remaining_qty - $1),
                  updated_at = NOW()
              WHERE id = $2
              `,
              [delta, subscriptionId]
            );
          } else if (prevStatus === 'delivered' && status !== 'delivered') {
            await client.query(
              `
              UPDATE subscriptions
              SET delivered_qty = GREATEST(0, delivered_qty - $1),
                  remaining_qty = remaining_qty + $1,
                  updated_at = NOW()
              WHERE id = $2
              `,
              [delta, subscriptionId]
            );
          }
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (!result || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
      });
    }

    if (
      status === 'delivered' &&
      prevScheduleStatus !== 'delivered' &&
      subscriptionIdForHook
    ) {
      const sub = await subscriptionModel.getSubscriptionById(subscriptionIdForHook);
      if (
        sub &&
        String(sub.status || '').toLowerCase() === 'pending' &&
        sub.isTrial &&
        sub.trialCheckoutOrderId
      ) {
        await subscriptionService.activateTrialSubscriptionsForTrialOrderIfPending(sub.trialCheckoutOrderId);
      }
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Delivery status updated',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Banners ==========

/**
 * Get all banners (admin view)
 * GET /api/admin/banners
 */
const getAllBanners = async (req, res, next) => {
  try {
    const banners = await bannerService.getAllBanners();

    res.json({
      success: true,
      data: banners,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create banner
 * POST /api/admin/banners
 */
const createBanner = async (req, res, next) => {
  try {
    // Extract files from multer fields
    const desktopImage = req.files?.image?.[0] || null;
    const mobileImage = req.files?.mobileImage?.[0] || null;

    // Debug: Log file information
    console.log('[ADMIN] Creating banner...', {
      hasDesktopImage: !!desktopImage,
      hasMobileImage: !!mobileImage,
      desktopImageInfo: desktopImage ? {
        fieldname: desktopImage.fieldname,
        originalname: desktopImage.originalname,
        size: desktopImage.size,
        hasBuffer: !!desktopImage.buffer,
      } : null,
      mobileImageInfo: mobileImage ? {
        fieldname: mobileImage.fieldname,
        originalname: mobileImage.originalname,
        size: mobileImage.size,
        hasBuffer: !!mobileImage.buffer,
      } : null,
      body: req.body,
    });

    if (!desktopImage && !req.body.imageUrl && !req.body.images) {
      return res.status(400).json({
        success: false,
        error: 'At least one banner image is required',
      });
    }

    const banner = await bannerService.createBanner(req.body, desktopImage, mobileImage);

    res.status(201).json({
      success: true,
      data: banner,
      message: 'Banner created successfully',
    });
  } catch (error) {
    console.error('[ADMIN] Banner creation error:', {
      message: error.message || error.toString(),
      name: error.name,
      stack: error.stack,
      error: error,
    });
    next(error);
  }
};

/**
 * Update banner
 * PUT /api/admin/banners/:id
 */
const updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Extract files from multer fields
    const desktopImage = req.files?.image?.[0] || null;
    const mobileImage = req.files?.mobileImage?.[0] || null;

    // Parse form data - handle link field
    const updates = { ...req.body };
    if (updates.link !== undefined) {
      updates.link = updates.link || null; // Convert empty string to null
    }

    const banner = await bannerService.updateBanner(id, updates, desktopImage, mobileImage);

    res.json({
      success: true,
      data: banner,
      message: 'Banner updated successfully',
    });
  } catch (error) {
    console.error('[ADMIN] Banner update error:', error);
    next(error);
  }
};

/**
 * Delete banner
 * DELETE /api/admin/banners/:id
 */
const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    await bannerService.deleteBanner(id);

    res.json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Site Content ==========

/**
 * Get all site content (admin view)
 * GET /api/admin/content
 */
const getAllSiteContent = async (req, res, next) => {
  try {
    const content = await siteContentModel.getAllContent();

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get site content by type
 * GET /api/admin/content/:type
 */
const getSiteContentByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    const content = await siteContentModel.getContentByTypeAdmin(type);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Content of type '${type}' not found`,
      });
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update site content
 * PUT /api/admin/content/:type
 */
const upsertSiteContent = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { title, content, metadata } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required',
      });
    }

    const updatedContent = await siteContentModel.upsertContent(type, {
      title,
      content,
      metadata,
    });

    res.json({
      success: true,
      data: updatedContent,
      message: 'Content saved successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle site content status
 * PATCH /api/admin/content/:type/status
 */
const toggleContentStatus = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean',
      });
    }

    const content = await siteContentModel.updateContentStatus(type, isActive);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Content of type '${type}' not found`,
      });
    }

    res.json({
      success: true,
      data: content,
      message: `Content ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// ========== Categories ==========

/**
 * Get all categories
 * GET /api/admin/categories
 */
const getAllCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.getAllCategories();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create category
 * POST /api/admin/categories
 */
const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body);

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update category
 * PUT /api/admin/categories/:id
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await categoryService.updateCategory(id, req.body);

    res.json({
      success: true,
      data: category,
      message: 'Category updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete category
 * DELETE /api/admin/categories/:id
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await categoryService.deleteCategory(id);

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Coupons ==========

/**
 * Get all coupons
 * GET /api/admin/coupons
 */
const getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await couponModel.getAllCoupons();

    res.json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get coupon by ID
 * GET /api/admin/coupons/:id
 */
const getCouponById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coupon = await couponModel.getCouponById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      });
    }

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create coupon
 * POST /api/admin/coupons
 */
const createCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.createCoupon(req.body);

    res.status(201).json({
      success: true,
      data: coupon,
      message: 'Coupon created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update coupon
 * PUT /api/admin/coupons/:id
 */
const updateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coupon = await couponService.updateCoupon(id, req.body);

    res.json({
      success: true,
      data: coupon,
      message: 'Coupon updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete coupon
 * DELETE /api/admin/coupons/:id
 */
const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    await couponModel.deleteCoupon(id);

    res.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload or update logo (Cloudinary + site_content type 'logo')
 * POST /api/admin/logo
 * Body: FormData with optional 'image' (file), 'widthPx' (number, default 120), and 'widthPxMobile' (number, default same as widthPx)
 * - With image: upload to Cloudinary houseofdahlia/logo, delete old if any, upsert metadata { imageUrl, imagePublicId, widthPx, widthPxMobile }
 * - Without image: update only widthPx and widthPxMobile in existing logo (requires existing logo)
 */
const upsertLogo = async (req, res, next) => {
  try {
    const widthPxRaw = req.body.widthPx;
    const widthPx = widthPxRaw != null && widthPxRaw !== '' ? parseInt(String(widthPxRaw), 10) : null;
    const numWidth = typeof widthPx === 'number' && !Number.isNaN(widthPx) ? Math.max(40, Math.min(320, widthPx)) : null;

    const widthPxMobileRaw = req.body.widthPxMobile;
    const widthPxMobile = widthPxMobileRaw != null && widthPxMobileRaw !== '' ? parseInt(String(widthPxMobileRaw), 10) : null;
    const numWidthMobile = typeof widthPxMobile === 'number' && !Number.isNaN(widthPxMobile) ? Math.max(40, Math.min(320, widthPxMobile)) : null;

    let existing = null;
    try {
      existing = await siteContentModel.getContentByTypeAdmin('logo');
    } catch {
      // ignore
    }

    if (req.file && req.file.buffer) {
      const uploadResult = await uploadImage(req.file.buffer, { folder: 'houseofdahlia/logo' });
      if (existing && existing.metadata && existing.metadata.imagePublicId) {
        try {
          await deleteImage(existing.metadata.imagePublicId);
        } catch (e) {
          console.warn('[LOGO] Could not delete old Cloudinary image:', e?.message);
        }
      }
      const metadata = {
        imageUrl: uploadResult.url,
        imagePublicId: uploadResult.publicId,
        widthPx: numWidth ?? existing?.metadata?.widthPx ?? 120,
        widthPxMobile: numWidthMobile ?? existing?.metadata?.widthPxMobile ?? numWidth ?? existing?.metadata?.widthPx ?? 120,
      };
      const updated = await siteContentModel.upsertContent('logo', {
        title: 'Logo',
        content: '',
        metadata,
      });
      return res.json({ success: true, data: updated, message: 'Logo uploaded successfully' });
    }

    if (!existing) {
      return res.status(400).json({
        success: false,
        error: 'Upload an image first. Width can only be changed when a logo is already set.',
      });
    }
    const metadata = {
      ...(existing.metadata || {}),
      widthPx: numWidth ?? existing.metadata?.widthPx ?? 120,
      widthPxMobile: numWidthMobile ?? existing.metadata?.widthPxMobile ?? numWidth ?? existing.metadata?.widthPx ?? 120,
    };
    const updated = await siteContentModel.upsertContent('logo', {
      title: 'Logo',
      content: '',
      metadata,
    });
    return res.json({ success: true, data: updated, message: 'Logo width updated' });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload or update favicon (Cloudinary + site_content type 'favicon')
 * POST /api/admin/favicon
 * Body: FormData with required 'image'
 */
const upsertFavicon = async (req, res, next) => {
  try {
    let existing = null;
    try {
      existing = await siteContentModel.getContentByTypeAdmin('favicon');
    } catch {
      // ignore
    }

    if (!req.file || !req.file.buffer) {
      if (existing) {
        return res.json({ success: true, data: existing, message: 'Existing favicon returned' });
      }
      return res.status(400).json({
        success: false,
        error: 'Upload an image first to set the favicon.',
      });
    }

    const uploadResult = await uploadImage(req.file.buffer, { folder: 'houseofdahlia/favicon' });
    if (existing?.metadata?.imagePublicId) {
      try {
        await deleteImage(existing.metadata.imagePublicId);
      } catch (e) {
        console.warn('[FAVICON] Could not delete old Cloudinary image:', e?.message);
      }
    }

    const updated = await siteContentModel.upsertContent('favicon', {
      title: 'Favicon',
      content: '',
      metadata: {
        imageUrl: uploadResult.url,
        imagePublicId: uploadResult.publicId,
      },
    });
    return res.json({ success: true, data: updated, message: 'Favicon uploaded successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload an image for a specific content type (Cloudinary + site_content metadata)
 * POST /api/admin/content/:type/image
 */
const uploadContentImage = async (req, res, next) => {
  try {
    const { type } = req.params;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded',
      });
    }

    let existing = null;
    try {
      existing = await siteContentModel.getContentByTypeAdmin(type);
    } catch (e) {
      // ignore
    }

    if (!existing) {
      existing = await siteContentModel.upsertContent(type, {
        title: type,
        content: '',
        metadata: {},
      });
    }

    const uploadResult = await uploadImage(req.file.buffer, { folder: `houseofdahlia/content/${type}` });

    if (existing.metadata && existing.metadata.imagePublicId) {
      try {
        await deleteImage(existing.metadata.imagePublicId);
      } catch (e) {
        console.warn(`[CONTENT IMAGE] Could not delete old Cloudinary image for ${type}:`, e?.message);
      }
    }

    const updatedMetadata = {
      ...(existing.metadata || {}),
      imageUrl: uploadResult.url,
      imagePublicId: uploadResult.publicId,
    };

    const updated = await siteContentModel.upsertContent(type, {
      title: existing.title || type,
      content: existing.content || '',
      metadata: updatedMetadata,
    });

    res.json({
      success: true,
      data: updated,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending orders count (for admin sidebar badge)
 * Counts orders that still need early fulfillment attention (placed / confirmed).
 * Excludes package_prepared and later — badge drops once prep is marked.
 * GET /api/admin/orders/pending-count
 */
const getPendingOrdersCount = async (req, res, next) => {
  try {
    const result = await query(
      `
      SELECT COUNT(*) as count
      FROM orders
      WHERE status NOT IN (
          'delivered',
          'cancelled',
          'refunded'
        )
        AND fulfilled_at IS NULL
        AND (
          payment_method = 'cod'
          OR payment_status IN ('paid', 'cod', 'refunded')
        )
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions st
          WHERE st.is_trial IS TRUE
            AND (st.trial_checkout_order_id = orders.id OR (
              orders.razorpay_order_id IS NOT NULL AND BTRIM(orders.razorpay_order_id::text) <> ''
              AND st.razorpay_subscription_id::text = BTRIM(orders.razorpay_order_id::text)
            ))
        )
      `
    );
    const count = parseInt(result.rows[0]?.count || 0, 10);
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};

function normalizeAdminManualInt(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(String(val), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/admin/customers/lookup-email?email=
 * Returns whether the email is registered (users table).
 */
const lookupCustomerEmail = async (req, res, next) => {
  try {
    const email = String(req.query?.email || '').trim();
    if (!email) {
      return res.json({ success: true, data: { registered: false } });
    }
    const user = await userModel.findByEmail(email);
    res.json({
      success: true,
      data: {
        registered: !!user,
        userId: user?.id || null,
        name: user?.name || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/orders/manual
 * Creates a checkout order for an existing customer (admin). Address is stored on the order only.
 */
const createManualOrder = async (req, res, next) => {
  try {
    const body = req.body || {};
    const customerName = String(body.customerName || '').trim();
    const phone = String(body.phone || '').trim();
    const street = String(body.street || '').trim();
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim();
    const postalCode = String(body.postalCode || body.postal_code || '').trim();
    const customerEmail = String(body.customerEmail || '').trim().toLowerCase();
    const paymentKind = String(body.paymentKind || body.payment_kind || '').toLowerCase();
    const deliveryChargesRaw = body.deliveryCharges ?? body.delivery_charges;
    const itemsIn = Array.isArray(body.items) ? body.items : [];

    if (!customerName) throw new ValidationError('Customer name is required');
    if (!phone) throw new ValidationError('Phone is required');
    if (!street) throw new ValidationError('Street is required');
    if (!city) throw new ValidationError('City is required');
    if (!state) throw new ValidationError('State is required');
    if (!postalCode) throw new ValidationError('Postal code is required');
    if (!customerEmail) throw new ValidationError('Customer email is required');
    if (paymentKind !== 'prepaid' && paymentKind !== 'cod') {
      throw new ValidationError('Payment status must be prepaid or cod');
    }
    if (itemsIn.length === 0) throw new ValidationError('At least one product line is required');

    const user = await userModel.findByEmail(customerEmail);
    if (!user) throw new ValidationError('No account found for this email');

    const deliveryCharges = roundMoney(Number(deliveryChargesRaw));
    if (!Number.isFinite(deliveryCharges) || deliveryCharges < 0) {
      throw new ValidationError('Delivery charges must be a non-negative number');
    }

    const computedItems = [];
    let subtotal = 0;

    for (const raw of itemsIn) {
      const productId = normalizeAdminManualInt(raw?.productId);
      const variationId = normalizeAdminManualInt(raw?.variationId);
      const quantity = normalizeAdminManualInt(raw?.quantity);

      if (!productId || !quantity || quantity <= 0) {
        throw new ValidationError('Each line needs a valid product and quantity');
      }

      const productRes = await query(
        `
        SELECT id, name, price_per_litre, selling_price, compare_at_price, quantity, is_active
        FROM products
        WHERE id = $1
        `,
        [productId]
      );
      if (productRes.rows.length === 0) throw new ValidationError('Product not found');
      const p = productRes.rows[0];
      if (!p.is_active) throw new ValidationError(`Product "${p.name}" is not active`);

      const stockQty = p.quantity != null ? parseInt(p.quantity, 10) : null;
      if (stockQty !== null && Number.isFinite(stockQty) && stockQty < quantity) {
        throw new ValidationError(`Insufficient stock for "${p.name}"`);
      }

      let variation = null;
      const varCountRes = await query(
        `SELECT COUNT(*)::int AS c FROM product_variations WHERE product_id = $1`,
        [productId]
      );
      const variationCount = varCountRes.rows[0]?.c || 0;

      if (variationCount > 0) {
        if (!variationId) {
          throw new ValidationError(`Select a size/variation for "${p.name}"`);
        }
        const varRes = await query(
          `
          SELECT id, size, price_multiplier, price, compare_at_price, is_available
          FROM product_variations
          WHERE id = $1 AND product_id = $2
          `,
          [variationId, productId]
        );
        if (varRes.rows.length === 0) throw new ValidationError('Invalid product variation');
        variation = varRes.rows[0];
        if (variation.is_available === false) {
          throw new ValidationError(`Variation is not available for "${p.name}"`);
        }
      } else if (variationId) {
        throw new ValidationError(`Product "${p.name}" has no variations`);
      }

      const basePrice =
        p.selling_price !== null && p.selling_price !== undefined
          ? parseFloat(p.selling_price)
          : parseFloat(p.price_per_litre);

      const mult =
        variation?.price_multiplier !== null && variation?.price_multiplier !== undefined
          ? parseFloat(variation.price_multiplier)
          : 1;

      const unitPrice =
        variation?.price !== null && variation?.price !== undefined
          ? parseFloat(variation.price)
          : basePrice * mult;

      const lineTotal = roundMoney(unitPrice * quantity);
      subtotal += lineTotal;

      computedItems.push({
        productId,
        variationId: variationId || null,
        productName: p.name,
        variationSize: variation?.size || null,
        unitPrice,
        quantity,
        lineTotal,
      });
    }

    subtotal = roundMoney(subtotal);

    await assertProductsDeliverableToPostalCode(
      computedItems.map((it) => ({ productId: it.productId })),
      postalCode
    );

    const platformFee = await getPlatformFeeAmount();
    const total = roundMoney(subtotal + platformFee + deliveryCharges);

    const latRaw = body.latitude ?? body.lat;
    const lngRaw = body.longitude ?? body.lng;
    const lat =
      latRaw !== null && latRaw !== undefined && latRaw !== ''
        ? parseFloat(String(latRaw))
        : NaN;
    const lng =
      lngRaw !== null && lngRaw !== undefined && lngRaw !== ''
        ? parseFloat(String(lngRaw))
        : NaN;

    const deliveryAddress = {
      name: customerName,
      phone,
      street,
      city,
      state,
      postalCode,
      country: 'India',
    };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      deliveryAddress.latitude = lat;
      deliveryAddress.longitude = lng;
    }

    const id = crypto.randomUUID();
    const orderNumber = id.split('-')[0].toUpperCase();

    const paymentMethod = paymentKind === 'prepaid' ? 'online' : 'cod';
    const paymentStatus = paymentKind === 'prepaid' ? 'paid' : 'cod';

    const order = await orderModel.createOrder({
      id,
      userId: user.id,
      orderNumber,
      status: 'placed',
      paymentMethod,
      paymentStatus,
      currency: 'INR',
      subtotal,
      discount: 0,
      platformFee,
      deliveryCharges,
      total,
      deliveryAddress,
      items: computedItems,
      razorpayOrderId: null,
      walletUsed: 0,
      savingsAmount: 0,
      couponCode: null,
    });

    try {
      await adminPushService.notifyAdminsAboutOrder(
        {
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          paymentStatus: order.paymentStatus,
        },
        { containsSubscription: false, eventKey: `order:${order.id}:admin-manual` }
      );
    } catch (e) {
      console.error('[ADMIN ORDER] Admin push failed:', e?.message || e);
    }

    res.status(201).json({
      success: true,
      data: {
        ...order,
        breakdown: {
          subtotal,
          platformFee,
          deliveryCharges,
          total,
        },
      },
      message: 'Order created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cart abandonment (admin analytics)
 * GET /api/admin/analytics/cart-abandonment?days=30
 */
const getCartAbandonment = async (req, res, next) => {
  try {
    const daysRaw = req.query?.days;
    const days = daysRaw != null ? Math.max(1, Math.min(365, parseInt(String(daysRaw), 10))) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await cartAnalytics.getCartAbandonment({ sinceIso: since.toISOString() });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getLatestFeedbackTime = async (req, res, next) => {
  try {
    const generalFeedbackModel = require('../models/generalFeedback');
    const latest = await generalFeedbackModel.getLatestFeedbackTimestamp();
    res.json({ success: true, data: { latest } });
  } catch (error) {
    next(error);
  }
};

// ========== Media Library (Cloudinary) ==========

/**
 * Get media library images from Cloudinary
 * GET /api/admin/media
 */
const getMediaLibrary = async (req, res, next) => {
  try {
    const { maxResults, nextCursor, folder, search } = req.query;
    const result = await listMediaResources({
      maxResults: maxResults ? parseInt(maxResults) : 60,
      nextCursor,
      folder,
      search,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload image directly to Cloudinary media library
 * POST /api/admin/media/upload
 */
const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('Image file is required');
    }

    const folder = req.body.folder || 'houseofdahlia/media';
    const uploadResult = await uploadImage(req.file.buffer, {
      folder,
    });

    res.status(201).json({
      success: true,
      data: uploadResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete image from Cloudinary media library
 * DELETE /api/admin/media
 */
const deleteMedia = async (req, res, next) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      throw new ValidationError('publicId is required');
    }

    const result = await deleteImage(publicId);

    res.json({
      success: true,
      message: 'Image deleted from Cloudinary successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Products
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadPendingCustomizationAsset,
  addProductImage,
  uploadProductDetailAsset,
  uploadProductCustomizationAsset,
  reorderProductImages,
  deleteProductImage,
  addProductVariation,
  updateProductVariation,
  deleteProductVariation,
  addProductReview,
  updateProductReview,
  deleteProductReview,
  // Users
  getAllUsers,
  getUserById,
  // Orders & Customers
  getAllOrders,
  getOrderById,
  getPendingOrdersCount,
  createManualOrder,
  lookupCustomerEmail,
  getCartAbandonment,
  markOrderAsPackagePrepared,
  listOrderDeliveries,
  listOutForDeliveryStops,
  markOrderAsOutForDelivery,
  markOrderAsDelivered,
  markOrderAsFulfilled,
  getCustomerStats,
  updateCustomerWalletBalance,
  getFeedback,
  getLatestFeedbackTime,
  // Subscriptions
  getAllSubscriptions,
  getSubscriptionById,
  pauseSubscription,
  resumeSubscription,
  // Deliveries
  getDeliveries,
  updateDeliveryStatus,
  // Banners
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  // Site Content
  getAllSiteContent,
  getSiteContentByType,
  upsertSiteContent,
  toggleContentStatus,
  upsertLogo,
  upsertFavicon,
  uploadContentImage,
  // Categories
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Coupons
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  // Media Library
  getMediaLibrary,
  uploadMedia,
  deleteMedia,
};

