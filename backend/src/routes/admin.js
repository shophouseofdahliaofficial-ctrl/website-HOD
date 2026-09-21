const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const adminNotificationController = require('../controllers/adminNotificationController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { uploadVideoToDrive } = require('../services/googleDrive');
const { query } = require('../config/database');

/**
 * Admin Routes
 * Base path: /api/admin
 * All routes require authentication AND admin role
 */

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

// Configure multer for image uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for customization/detail images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Products
router.get('/products', adminController.getAllProducts);
router.post('/products/customization-assets', upload.single('image'), adminController.uploadPendingCustomizationAsset);
router.get('/products/:id', adminController.getProductById);
router.post('/products', upload.single('image'), adminController.createProduct);
router.put('/products/:id', upload.single('image'), adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Product Images
router.post('/products/:id/images', upload.single('image'), adminController.addProductImage);
router.post('/products/:id/detail-assets', upload.single('image'), adminController.uploadProductDetailAsset);
router.post('/products/:id/customization-assets', upload.single('image'), adminController.uploadProductCustomizationAsset);
router.put('/products/:id/images/reorder', adminController.reorderProductImages);
router.delete('/products/:id/images/:imageId', adminController.deleteProductImage);

// Product Variations
router.post('/products/:id/variations', adminController.addProductVariation);
router.put('/products/:id/variations/:variationId', adminController.updateProductVariation);
router.delete('/products/:id/variations/:variationId', adminController.deleteProductVariation);

// Product Reviews
router.post('/products/:id/reviews', adminController.addProductReview);
router.put('/products/:id/reviews/:reviewId', adminController.updateProductReview);
router.delete('/products/:id/reviews/:reviewId', adminController.deleteProductReview);

// Users
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);

// Orders & Customers
router.get('/orders', adminController.getAllOrders);
router.get('/orders/pending-count', adminController.getPendingOrdersCount);
router.post('/orders/manual', adminController.createManualOrder);
router.get('/orders/:id', adminController.getOrderById);
router.post('/orders/:id/mark-package-prepared', adminController.markOrderAsPackagePrepared);
router.post('/orders/:id/mark-out-for-delivery', adminController.markOrderAsOutForDelivery);
router.post('/orders/:id/mark-delivered', adminController.markOrderAsDelivered);
router.post('/orders/:id/mark-fulfilled', adminController.markOrderAsFulfilled);
router.get('/order-deliveries', adminController.listOrderDeliveries);
router.get('/order-delivery-stops', adminController.listOutForDeliveryStops);
router.get('/customers/lookup-email', adminController.lookupCustomerEmail);
router.get('/customers', adminController.getCustomerStats);
router.patch('/customers/:id/wallet', adminController.updateCustomerWalletBalance);
router.get('/feedback', adminController.getFeedback);
router.get('/feedback/latest', adminController.getLatestFeedbackTime);

// Subscriptions
router.get('/subscriptions', adminController.getAllSubscriptions);
router.get('/subscriptions/:id', adminController.getSubscriptionById);
router.post('/subscriptions/:id/pause', adminController.pauseSubscription);
router.post('/subscriptions/:id/resume', adminController.resumeSubscription);

// Deliveries
router.get('/deliveries', adminController.getDeliveries);
router.put('/deliveries/:id', adminController.updateDeliveryStatus);

// Banners
router.get('/banners', adminController.getAllBanners);
router.post('/banners', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]), adminController.createBanner);
router.put('/banners/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]), adminController.updateBanner);
router.delete('/banners/:id', adminController.deleteBanner);

// Site Content (Terms, Privacy, About, Contact, Reviews)
router.get('/content', adminController.getAllSiteContent);
router.get('/content/:type', adminController.getSiteContentByType);
router.put('/content/:type', adminController.upsertSiteContent);
router.post('/content/:type/image', upload.single('image'), adminController.uploadContentImage);
router.patch('/content/:type/status', adminController.toggleContentStatus);

// Logo (upload to Cloudinary, store in site_content type 'logo')
router.post('/logo', upload.single('image'), adminController.upsertLogo);
router.post('/favicon', upload.single('image'), adminController.upsertFavicon);

// Categories
router.get('/categories', adminController.getAllCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Coupons
router.get('/coupons', adminController.getAllCoupons);
router.get('/coupons/:id', adminController.getCouponById);
router.post('/coupons', adminController.createCoupon);
router.put('/coupons/:id', adminController.updateCoupon);
router.delete('/coupons/:id', adminController.deleteCoupon);

// Cloudinary Media Library
router.get('/media', adminController.getMediaLibrary);
router.post('/media/upload', upload.single('image'), adminController.uploadMedia);
router.delete('/media', adminController.deleteMedia);

// Analytics
router.get('/analytics/cart-abandonment', adminController.getCartAbandonment);

// Push notifications
router.post('/push/register-token', adminNotificationController.registerPushToken);
router.post('/push/send-test', adminNotificationController.sendTestPush);

// Configure multer for video uploads (memory storage, up to 50MB limit)
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  },
});

// Get pending options (orders and today's subscription deliveries) for batch verification dropdown
router.get('/verify/pending-orders', async (req, res, next) => {
  try {
    // 1. Fetch pending orders
    const ordersResult = await query(`
      SELECT 
        o.id AS order_id,
        o.order_number,
        o.total AS amount,
        u.name AS customer_name,
        string_agg(concat(oi.product_name, COALESCE(' ' || oi.variation_size, '')), ', ') AS items_description
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      INNER JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status NOT IN ('delivered', 'cancelled', 'refunded')
        AND (
          o.payment_method = 'cod'
          OR o.payment_status IN ('paid', 'cod', 'refunded')
        )
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions st
          WHERE st.is_trial IS TRUE
            AND (st.trial_checkout_order_id::text = o.id::text OR (
              o.razorpay_order_id IS NOT NULL AND BTRIM(o.razorpay_order_id::text) <> ''
              AND st.razorpay_subscription_id::text = BTRIM(o.razorpay_order_id::text)
            ))
        )
      GROUP BY o.id, o.order_number, o.total, u.name, o.created_at
      ORDER BY o.created_at DESC
    `);

    // 2. Fetch today's pending subscription deliveries
    const subsResult = await query(`
      SELECT 
        ds.id AS schedule_id,
        s.id AS subscription_id,
        s.litres_per_day,
        u.name AS customer_name,
        p.name AS product_name,
        pv.size AS variation_size
      FROM delivery_schedules ds
      LEFT JOIN subscriptions s ON ds.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN product_variations pv ON s.product_variation_id = pv.id
      WHERE ds.delivery_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
        AND ds.status = 'pending'
        AND (
          s.status = 'active'
          OR (s.status = 'pending' AND s.is_trial IS TRUE)
          OR (s.status = 'pending' AND s.checkout_order_id IS NOT NULL)
        )
        AND NOT (
          s.first_day_shift_applied IS TRUE
          AND ds.delivery_date = s.start_date
        )
      ORDER BY ds.id ASC
    `);

    // 3. Map both results to a unified array of options
    const options = [
      ...ordersResult.rows.map(row => ({
        type: 'order',
        id: row.order_id,
        number: row.order_number,
        amount: parseFloat(row.amount),
        customerName: row.customer_name || 'Walk-in Customer',
        description: row.items_description
      })),
      ...subsResult.rows.map(row => ({
        type: 'subscription',
        id: row.schedule_id,
        number: `SUB-${row.subscription_id}`,
        amount: null,
        customerName: row.customer_name || 'Customer',
        description: `${row.product_name}${row.variation_size ? ' ' + row.variation_size : ''} (${parseFloat(row.litres_per_day)}L/day)`
      }))
    ];

    res.json({
      success: true,
      orders: options // Keep the key 'orders' for frontend backwards-compatibility
    });
  } catch (err) {
    console.error('❌ Error getting pending options for verification:', err);
    next(err);
  }
});

// Admin video upload and verification save endpoint
router.post(
  '/verify/upload',
  videoUpload.single('video'),
  async (req, res, next) => {
    try {
      const { ucCode, orderId, deliveryScheduleId, selectedKeys } = req.body;
      
      if (!ucCode || ucCode.trim().length !== 6) {
        return res.status(400).json({
          success: false,
          error: 'ucCode must be exactly 6 characters.',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Video file is required.',
        });
      }

      const cleanCode = ucCode.trim().toUpperCase();
      let parsedKeys = [];
      if (selectedKeys) {
        try {
          parsedKeys = JSON.parse(selectedKeys);
        } catch (e) {
          console.warn('Failed to parse selectedKeys:', e);
        }
      }

      // Backwards compatibility for single-item requests
      if (parsedKeys.length === 0) {
        if (orderId && orderId !== '' && orderId !== 'null') {
          parsedKeys.push(`order:${orderId}`);
        }
        if (deliveryScheduleId && deliveryScheduleId !== '' && deliveryScheduleId !== 'null') {
          parsedKeys.push(`subscription:${deliveryScheduleId}`);
        }
      }

      console.log(`🎥 Uploading verification video for UC: ${cleanCode}, Linked keys count: ${parsedKeys.length}`);

      // Upload to Google Drive
      const uploadResult = await uploadVideoToDrive(
        req.file.buffer,
        `UC_${cleanCode}.webm`,
        req.file.mimetype
      );

      console.log(`💾 Saving verification records in database...`);
      
      // Delete any existing verifications for this uc_code to cleanly handle re-uploads / updates
      await query(`DELETE FROM verifications WHERE uc_code = $1`, [cleanCode]);

      const insertedRows = [];
      if (parsedKeys.length > 0) {
        for (const key of parsedKeys) {
          const [type, id] = key.split(':');
          const cleanOrderId = type === 'order' ? id : null;
          const cleanScheduleId = type === 'subscription' ? parseInt(id, 10) : null;

          const dbResult = await query(
            `INSERT INTO verifications (uc_code, video_url, drive_file_id, order_id, delivery_schedule_id) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [cleanCode, uploadResult.webViewLink, uploadResult.fileId, cleanOrderId, cleanScheduleId]
          );
          insertedRows.push(dbResult.rows[0]);
        }
      } else {
        // Fallback insert if no items are selected
        const dbResult = await query(
          `INSERT INTO verifications (uc_code, video_url, drive_file_id, order_id, delivery_schedule_id) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING *`,
          [cleanCode, uploadResult.webViewLink, uploadResult.fileId, null, null]
        );
        insertedRows.push(dbResult.rows[0]);
      }

      res.status(201).json({
        success: true,
        data: {
          id: insertedRows[0].id,
          ucCode: insertedRows[0].uc_code,
          videoUrl: insertedRows[0].video_url,
          driveFileId: insertedRows[0].drive_file_id,
          orderId: insertedRows[0].order_id,
          deliveryScheduleId: insertedRows[0].delivery_schedule_id,
          createdAt: insertedRows[0].created_at,
          count: insertedRows.length
        },
        message: 'Verification video uploaded and saved successfully.',
      });
    } catch (err) {
      console.error('❌ Error handling verification video upload route:', err);
      next(err);
    }
  }
);

// Creators
const creatorController = require('../controllers/creatorController');
router.get('/creators', creatorController.getAllCreators);
router.post('/creators', creatorController.createCreator);
router.put('/creators/:id', creatorController.updateCreator);
router.delete('/creators/:id', creatorController.deleteCreator);

module.exports = router;
