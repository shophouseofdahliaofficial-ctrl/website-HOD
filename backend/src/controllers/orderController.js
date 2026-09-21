const crypto = require('crypto');
const { ValidationError } = require('../utils/errors');
const { query, getClient } = require('../config/database');
const orderModel = require('../models/order');
const userModel = require('../models/user');
const couponModel = require('../models/coupon');
const couponService = require('../services/couponService');
const { createOrder: createRazorpayOrder, hasRazorpayKeys, getPayment: getRazorpayPayment } = require('../config/razorpay');
const walletService = require('../services/walletService');
const subscriptionService = require('../services/subscriptionService');
const adminPushService = require('../services/adminPushNotificationService');
const { calculateCheckoutFees, roundMoney } = require('../services/pricingService');
const {
  assertProductsDeliverableToPostalCode,
  assertSubscriptionPostalCodeServiceable,
} = require('../services/productDeliverabilityService');
const shiprocketService = require('../services/shiprocketService');

async function incrementCouponUsageByCode(couponCode) {
  const code = (couponCode || '').toString().trim().toUpperCase();
  if (!code) return;
  try {
    const coupon = await couponModel.getCouponByCode(code);
    if (!coupon) return;
    await couponModel.incrementUsedCount(coupon.id);
  } catch (e) {
    console.error('[ORDER] Failed to increment coupon usage:', {
      code,
      message: e?.message,
    });
  }
}

async function markPhotoboothProjectOrdered(projectId, userId) {
  if (!projectId) return;
  try {
    await query(
      `UPDATE photobooth_projects SET status = 'ordered', updated_at = NOW() WHERE id::text = $1::text AND (user_id IS NULL OR user_id::text = $2::text)`,
      [String(projectId), String(userId)]
    );
  } catch (e) {
    console.warn('[ORDER] Could not mark photobooth project ordered:', e?.message || e);
  }
}

async function lockPhotobookProjectsForItems(items, userId) {
  if (!Array.isArray(items)) return;
  for (const it of items) {
    if (it.photobookProjectId) {
      try {
        await query(
          `UPDATE photobook_projects SET status = 'ordered', updated_at = NOW() WHERE id::text = $1::text AND (user_id IS NULL OR user_id::text = $2::text)`,
          [String(it.photobookProjectId), String(userId)]
        );
      } catch (e) {
        console.warn('[ORDER] Could not mark photobook project ordered:', e?.message || e);
      }
    }
  }
}

function getDeliveryCount(freq, durationDays) {
  if (freq === 'alternate') return Math.floor((durationDays - 1) / 2) + 1;
  if (freq === 'weekly') return Math.floor((durationDays - 1) / 7) + 1;
  if (freq === 'monthly') return Math.floor((durationDays - 1) / 30) + 1;
  return durationDays;
}

async function notifyAdminsForOrder(order, { containsSubscription = false, eventKey } = {}) {
  try {
    await adminPushService.notifyAdminsAboutOrder(
      {
        ...order,
        containsSubscription,
      },
      { eventKey }
    );
  } catch (error) {
    console.error('[ORDER] Failed to send admin push:', error?.message || error);
  }
}

function normalizeInt(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(String(val), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Create an order (COD / Online placeholder)
 * POST /api/orders
 */
const createOrder = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { items, deliveryAddress, couponCode, paymentMethod, subscriptionItem, creatorSlug } = req.body || {};

    if (!userId) throw new ValidationError('User not found');
    const hasNormalItems = Array.isArray(items) && items.length > 0;
    const hasSubscriptionItem = !!subscriptionItem && typeof subscriptionItem === 'object';
    if (!hasNormalItems && !hasSubscriptionItem) throw new ValidationError('Order items are required');
    if (!deliveryAddress) throw new ValidationError('Delivery address is required');
    const deliveryPostalCode = deliveryAddress.postalCode || deliveryAddress.postal_code;

    const method = (paymentMethod || 'cod').toString().toLowerCase();
    if (method !== 'cod' && method !== 'online' && method !== 'wallet') throw new ValidationError('Invalid payment method');
    
    let totalSavings = 0;

    // Compute item pricing server-side
    const computedItems = [];
    let subtotal = 0;

    for (const raw of (Array.isArray(items) ? items : [])) {
      const productId = normalizeInt(raw?.productId);
      const variationId = normalizeInt(raw?.variationId);
      const quantity = normalizeInt(raw?.quantity);

      if (!productId || !quantity || quantity <= 0) {
        throw new ValidationError('Invalid order item');
      }

      const productRes = await query(
        `
        SELECT id, name, price_per_litre, selling_price, compare_at_price, is_nationwide_delivery, delivery_pincodes, weight
        FROM products
        WHERE id = $1
        `,
        [productId]
      );
      if (productRes.rows.length === 0) throw new ValidationError('Product not found');
      const p = productRes.rows[0];

      let isItemNationwide = false;
      if (p.is_nationwide_delivery) {
        const rawPincodes = Array.isArray(p.delivery_pincodes) ? p.delivery_pincodes : [];
        const allowedPincodes = rawPincodes.map(entry => {
          if (entry && typeof entry === 'object') {
            return String(entry.pincode || '').trim();
          }
          return String(entry || '').trim();
        });
        if (deliveryPostalCode && !allowedPincodes.includes(String(deliveryPostalCode).trim())) {
          isItemNationwide = true;
        }
      }

      let variation = null;
      if (variationId) {
        const varRes = await query(
          `
          SELECT id, size, price_multiplier, price, compare_at_price, weight
          FROM product_variations
          WHERE id = $1 AND product_id = $2
          `,
          [variationId, productId]
        );
        if (varRes.rows.length === 0) throw new ValidationError('Invalid product variation');
        variation = varRes.rows[0];
      }

      const basePrice = p.selling_price !== null && p.selling_price !== undefined
        ? parseFloat(p.selling_price)
        : parseFloat(p.price_per_litre);

      const mult = variation?.price_multiplier !== null && variation?.price_multiplier !== undefined
        ? parseFloat(variation.price_multiplier)
        : 1;

      const unitPrice = variation?.price !== null && variation?.price !== undefined
        ? parseFloat(variation.price)
        : basePrice * mult;

      // Savings calculation
      const baseCompare = p.compare_at_price !== null && p.compare_at_price !== undefined
        ? parseFloat(p.compare_at_price)
        : null;
      const variationCompare = variation?.compare_at_price !== null && variation?.compare_at_price !== undefined
        ? parseFloat(variation.compare_at_price)
        : null;
      const originalUnitPrice = variationCompare !== null
        ? variationCompare
        : baseCompare !== null
          ? baseCompare * mult
          : null;

      if (originalUnitPrice !== null && originalUnitPrice > unitPrice) {
        totalSavings += (originalUnitPrice - unitPrice) * quantity;
      }

      const giftWrap = raw?.customizations?.giftWrap || raw?.giftWrap || null;
      const giftWrapFee = giftWrap && typeof giftWrap === 'object' ? parseFloat(giftWrap.price || 25) : 0;
      const lineTotal = (unitPrice * quantity) + giftWrapFee;
      subtotal += lineTotal;

      computedItems.push({
        productId,
        variationId,
        productName: p.name,
        variationSize: variation?.size || null,
        unitPrice,
        quantity,
        lineTotal,
        isSubscription: false,
        isItemNationwide,
        weight: variation?.weight != null ? parseFloat(variation.weight) : (p.weight != null ? parseFloat(p.weight) : 0.1),
        customizations: raw?.customizations || null,
        giftWrap: giftWrap || null,
      });
    }

    const isNationwideDelivery = computedItems.some((item) => item.isItemNationwide);

    if (hasNormalItems) {
      await assertProductsDeliverableToPostalCode(items, deliveryPostalCode);
    }

    if (hasSubscriptionItem) {
      const subscriptionProductId = normalizeInt(subscriptionItem?.productId);
      const subscriptionVariationId = normalizeInt(
        subscriptionItem?.variationId
          ?? subscriptionItem?.variation_id
          ?? subscriptionItem?.productVariationId
          ?? subscriptionItem?.product_variation_id
      );
      const litresPerDay = Number(subscriptionItem?.litresPerDay);
      const durationMonths = Number(subscriptionItem?.durationMonths);
      const durationDaysRaw = subscriptionItem?.durationDays;
      const durationDays =
        durationDaysRaw != null && durationDaysRaw !== ''
          ? Number(durationDaysRaw)
          : NaN;
      const deliveryTime = (subscriptionItem?.deliveryTime || '').toString();

      const hasMonthDuration = Number.isFinite(durationMonths) && durationMonths > 0;
      const hasDayDuration = Number.isFinite(durationDays) && durationDays >= 1;
      if (
        !subscriptionProductId ||
        !Number.isFinite(litresPerDay) ||
        litresPerDay <= 0 ||
        (!hasMonthDuration && !hasDayDuration)
      ) {
        throw new ValidationError('Invalid subscription item');
      }

      const subProductRes = await query(
        `
        SELECT id, name, price_per_litre, selling_price, compare_at_price, is_membership_eligible, weight
        FROM products
        WHERE id = $1
        `,
        [subscriptionProductId]
      );
      if (subProductRes.rows.length === 0) throw new ValidationError('Subscription product not found');
      const sp = subProductRes.rows[0];
      if (!sp.is_membership_eligible) throw new ValidationError('Selected product is not eligible for subscription');

      let variation = null;
      if (subscriptionVariationId) {
        const variationRes = await query(
          `
          SELECT id, size, price_multiplier, price, compare_at_price, weight
          FROM product_variations
          WHERE id = $1 AND product_id = $2
          `,
          [subscriptionVariationId, subscriptionProductId]
        );
        if (variationRes.rows.length === 0) throw new ValidationError('Invalid subscription variation');
        variation = variationRes.rows[0];
      }

      const basePerUnit = sp.selling_price !== null && sp.selling_price !== undefined
        ? parseFloat(sp.selling_price)
        : parseFloat(sp.price_per_litre);
      const variationMultiplier =
        variation?.price_multiplier !== null && variation?.price_multiplier !== undefined
          ? parseFloat(variation.price_multiplier)
          : 1;
      const perUnit = variation?.price !== null && variation?.price !== undefined
        ? parseFloat(variation.price) / variationMultiplier
        : basePerUnit;
      
      const days = hasDayDuration
        ? Math.min(3650, Math.floor(durationDays))
        : Math.max(1, Math.round(durationMonths * 30));

      const frequency = (subscriptionItem?.frequency || 'daily').toString();
      const deliveryCount = Math.max(1, getDeliveryCount(frequency, days));

      // Subscription Savings calculation
      const subBaseCompare = sp.compare_at_price !== null && sp.compare_at_price !== undefined
        ? parseFloat(sp.compare_at_price)
        : null;
      const subVariationCompare = variation?.compare_at_price !== null && variation?.compare_at_price !== undefined
        ? parseFloat(variation.compare_at_price)
        : null;
      const subOriginalUnitPrice = subVariationCompare !== null
        ? subVariationCompare
        : subBaseCompare !== null
          ? subBaseCompare * variationMultiplier
          : null;

      const baseSellingForOne = variation?.price !== null && variation?.price !== undefined
        ? parseFloat(variation.price)
        : basePerUnit * variationMultiplier;

      if (subOriginalUnitPrice !== null && subOriginalUnitPrice > baseSellingForOne) {
        totalSavings += (subOriginalUnitPrice - baseSellingForOne) * litresPerDay * deliveryCount;
      }

      const subscriptionAmount = roundMoney(perUnit * (litresPerDay * variationMultiplier) * deliveryCount);
      subtotal += subscriptionAmount;

      const periodLabel = hasDayDuration
        ? `${Math.floor(durationDays)} day(s)`
        : `${durationMonths} month(s)`;

      computedItems.push({
        productId: subscriptionProductId,
        variationId: subscriptionVariationId,
        productName: `Subscription for ${sp.name}`,
        variationSize: `Qty: ${litresPerDay} L/day | Period: ${periodLabel} | Delivery: ${deliveryTime} | Frequency: ${frequency}`,
        unitPrice: subscriptionAmount,
        quantity: 1,
        lineTotal: subscriptionAmount,
        isSubscription: true,
        weight: variation?.weight != null ? parseFloat(variation.weight) : (sp.weight != null ? parseFloat(sp.weight) : 0.1),
      });

      await assertProductsDeliverableToPostalCode(
        [{ productId: subscriptionProductId }],
        deliveryPostalCode
      );
      await assertSubscriptionPostalCodeServiceable(deliveryPostalCode);
    }

    // Coupon (optional)
    let discount = 0;
    let normalizedCouponCode = null;
    if (couponCode) {
      normalizedCouponCode = String(couponCode).trim().toUpperCase();
      const coupon = await couponService.validateCoupon(normalizedCouponCode, subtotal);
      if (coupon.discountType === 'percentage') {
        discount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
          discount = coupon.maxDiscountAmount;
        }
      } else {
        discount = coupon.discountValue;
      }
      discount = Math.min(discount, subtotal);
      totalSavings += discount;
    }

    await orderModel.ensureOrdersSchema();
    const { platformFee, deliveryCharges } = await calculateCheckoutFees({
      userId,
      items,
      deliveryAddress,
      paymentMethod: method,
    });
    const total = roundMoney(subtotal - discount + deliveryCharges + platformFee);

    const id = crypto.randomUUID();
    const orderNumber = id.split('-')[0].toUpperCase();

    if (method === 'cod') {
      const order = await orderModel.createOrder({
        id,
        userId,
        orderNumber,
        status: 'placed',
        paymentMethod: 'cod',
        paymentStatus: 'cod',
        currency: 'INR',
        subtotal,
        discount,
        platformFee,
        deliveryCharges,
        total,
        deliveryAddress,
        items: computedItems,
        savingsAmount: totalSavings,
        couponCode: normalizedCouponCode,
        isNationwideDelivery,
        creatorSlug,
      });

      // Update user lifetime savings for successful COD/immediate payment
      await userModel.updateLifetimeSavings(userId, totalSavings);
      await incrementCouponUsageByCode(normalizedCouponCode);

      for (const it of computedItems) {
        if (it.photoboothProjectId) {
          await markPhotoboothProjectOrdered(it.photoboothProjectId, userId);
        }
      }
      await lockPhotobookProjectsForItems(computedItems, userId);

      if (hasSubscriptionItem) {
        await subscriptionService.createFromCheckoutOrder(order.id);
      }

      if (isNationwideDelivery) {
        try {
          const userDetails = await userModel.findById(userId);
          const shiprocketCustomer = {
            ...deliveryAddress,
            email: userDetails?.email || '',
          };
          const shiprocketRes = await shiprocketService.createShiprocketOrder(order, shiprocketCustomer, computedItems);
          if (shiprocketRes && shiprocketRes.order_id) {
            await query('UPDATE orders SET shiprocket_order_id = $1 WHERE id = $2', [
              String(shiprocketRes.order_id),
              order.id
            ]);
            console.log(`[ORDER] Saved Shiprocket Order ID ${shiprocketRes.order_id} for COD order ${order.orderNumber}`);
          }
        } catch (e) {
          console.error('[ORDER] Shiprocket integration failed for COD order:', e?.message || e);
        }
      }

      await notifyAdminsForOrder(
        {
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          paymentStatus: order.paymentStatus,
        },
        {
          containsSubscription: hasSubscriptionItem,
          eventKey: `order:${order.id}:cod`,
        }
      );

      return res.status(201).json({
        success: true,
        data: {
          ...order,
          couponCode: normalizedCouponCode,
        },
        message: 'Order placed successfully',
      });
    }

    if (method === 'wallet') {
      await walletService.ensureWalletSchema();
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      let walletUsed = 0;
      let remaining = total;

      if (method === 'wallet') {
        const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);
        const walletBalance = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].wallet_balance || 0) : 0;

        walletUsed = Math.max(0, Math.min(walletBalance, total));
        remaining = Math.max(0, Math.round((total - walletUsed) * 100) / 100);

        // For mixed wallet + online payments, wallet is debited only after Razorpay verification.
        // For pure wallet payments (remaining = 0), debit immediately in this transaction.
        if (walletUsed > 0 && remaining <= 0) {
          await client.query(
            `UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2`,
            [walletUsed, userId]
          );

          await client.query(
            `
            INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
            VALUES ($1, 'debit', $2, 'purchase', $3)
            ON CONFLICT DO NOTHING
            `,
            [userId, walletUsed, id]
          );

          // Update user lifetime savings for pure wallet payment
          await client.query(`UPDATE users SET lifetime_savings = lifetime_savings + $1, updated_at = NOW() WHERE id = $2`, [totalSavings, userId]);
        }
      }

      let razorpayOrderId = null;
      if (remaining > 0) {
        if (!hasRazorpayKeys) {
          throw new ValidationError('Online payment is not available. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
        }
        const rp = await createRazorpayOrder({
          amount: Math.round(remaining * 100),
          currency: 'INR',
          receipt: `milko_${orderNumber}_${Date.now()}`,
          notes: { order_id: id, order_number: orderNumber },
        });
        razorpayOrderId = rp.id;
      }

      const paymentMethodFinal = method === 'wallet' ? (walletUsed > 0 ? 'wallet' : 'online') : 'online';
      const paymentStatusFinal = remaining > 0 ? 'pending' : 'paid';

      const insRes = await client.query(
        `
        INSERT INTO orders (
          user_id, order_number, status, payment_method, payment_status,
          currency, subtotal, discount, platform_fee, delivery_charges, total, wallet_used, delivery_address, razorpay_order_id, savings_amount, coupon_code, is_nationwide_delivery, creator_slug,
          total_amount, discount_amount, final_amount, shipping_address
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING id
        `,
        [
          userId,
          orderNumber,
          'placed',
          paymentMethodFinal,
          paymentStatusFinal,
          'INR',
          subtotal,
          discount,
          platformFee,
          deliveryCharges,
          total,
          walletUsed,
          deliveryAddress,
          razorpayOrderId,
          totalSavings,
          normalizedCouponCode,
          isNationwideDelivery,
          creatorSlug || null,
          subtotal || total || 0,
          discount || 0,
          total || 0,
          deliveryAddress || null,
        ]
      );

      const dbOrderId = insRes.rows[0].id;

      for (const it of computedItems) {
        await client.query(
          `
          INSERT INTO order_items (
            order_id, product_id, variation_id, product_name, variation_size,
            unit_price, quantity, line_total, total_price, photobooth_project_id, photobook_project_id, photobook_image_check_url,
            customizations, customization_data, gift_wrap
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          `,
          [
            dbOrderId,
            it.productId,
            it.variationId,
            it.productName,
            it.variationSize,
            it.unitPrice,
            it.quantity,
            it.lineTotal,
            it.lineTotal || (it.unitPrice * it.quantity) || 0,
            it.photoboothProjectId || null,
            it.photobookProjectId || null,
            it.photobookImageCheckUrl || null,
            it.customizations ? JSON.stringify(it.customizations) : null,
            it.customizations ? JSON.stringify(it.customizations) : null,
            it.giftWrap ? JSON.stringify(it.giftWrap) : (it.customizations?.giftWrap ? JSON.stringify(it.customizations.giftWrap) : null),
          ]
        );

        if (!it.isSubscription) {
          await client.query(
            `
            UPDATE products
            SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
            WHERE id = $2
            `,
            [it.quantity, it.productId]
          );
        }
      }

      await client.query('COMMIT');

      if (razorpayOrderId) {
        return res.status(201).json({
          success: true,
          data: {
            orderId: String(dbOrderId),
            orderNumber,
            razorpayOrderId,
            key: process.env.RAZORPAY_KEY_ID,
            currency: 'INR',
            amount: Math.round(remaining * 100),
            walletUsed: Math.round(walletUsed * 100) / 100,
          },
          message: 'Open Razorpay to complete payment',
        });
      }

      if (hasSubscriptionItem) {
        await subscriptionService.createFromCheckoutOrder(dbOrderId);
      }
      for (const it of computedItems) {
        if (it.photoboothProjectId) {
          await markPhotoboothProjectOrdered(it.photoboothProjectId, userId);
        }
      }
      await lockPhotobookProjectsForItems(computedItems, userId);
      await incrementCouponUsageByCode(normalizedCouponCode);
      await notifyAdminsForOrder(
        {
          id: dbOrderId,
          orderNumber,
          total,
          paymentStatus: 'paid',
        },
        {
          containsSubscription: hasSubscriptionItem,
          eventKey: `order:${dbOrderId}:paid`,
        }
      );

      return res.status(201).json({
        success: true,
        data: {
          orderId: String(dbOrderId),
          orderNumber,
          paymentStatus: 'paid',
          walletUsed: Math.round(walletUsed * 100) / 100,
        },
        message: paymentMethodFinal === 'wallet' ? 'Order paid using wallet' : 'Order paid',
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Razorpay payment and mark order as paid
 * POST /api/orders/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id }
 */
const verifyPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId } = req.body || {};

    if (!userId) throw new ValidationError('User not found');
    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new ValidationError('razorpay_order_id and razorpay_payment_id are required');
    }

    const payment = await getRazorpayPayment(razorpayPaymentId);
    if (payment.status !== 'captured') {
      return res.status(400).json({ success: false, error: 'Payment not captured' });
    }
    if (payment.order_id !== razorpayOrderId) {
      return res.status(400).json({ success: false, error: 'Order ID mismatch' });
    }

    const orderRow = await query(
      'SELECT id, user_id, wallet_used, payment_status, savings_amount, coupon_code FROM orders WHERE razorpay_order_id = $1',
      [razorpayOrderId]
    );
    if (orderRow.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (orderRow.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not your order' });
    }

    const orderId = orderRow.rows[0].id;
    const walletUsed = parseFloat(orderRow.rows[0].wallet_used || 0);
    const couponCodeUsed = orderRow.rows[0].coupon_code || null;
    const isNationwideDelivery = orderRow.rows[0].is_nationwide_delivery;
    const wasAlreadyPaid = String(orderRow.rows[0].payment_status || '').toLowerCase() === 'paid';

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Idempotency: debit only if wallet transaction for this order doesn't exist yet.
      // This must run even when payment_status is already 'paid' (e.g. webhook updated status first).
      if (walletUsed > 0) {
        const txExists = await client.query(
          `SELECT 1 FROM wallet_transactions WHERE user_id = $1 AND type = 'debit' AND source = 'purchase' AND reference_id = $2 LIMIT 1`,
          [userId, orderId]
        );

        if (txExists.rows.length === 0) {
          const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);
          const walletBalance = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].wallet_balance || 0) : 0;
          if (walletBalance + 1e-9 < walletUsed) {
            throw new ValidationError('Wallet balance is insufficient to complete this payment');
          }

          await client.query(`UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2`, [
            walletUsed,
            userId,
          ]);

          await client.query(
            `
            INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
            VALUES ($1, 'debit', $2, 'purchase', $3)
            ON CONFLICT DO NOTHING
            `,
            [userId, walletUsed, orderId]
          );
        }
      }

      await client.query(
        `UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE razorpay_order_id = $1`,
        [razorpayOrderId]
      );

      if (payment.method === 'card' && payment.card) {
        const last4 = payment.card.last4 || '';
        const network = (payment.card.network || payment.card.brand || '').toString();
        await client.query(
          `UPDATE orders SET payment_card_last4 = $1, payment_card_network = $2, updated_at = NOW() WHERE razorpay_order_id = $3`,
          [last4, network, razorpayOrderId]
        );
      }

      // Update user lifetime savings upon verification
      const orderSavings = parseFloat(orderRow.rows[0].savings_amount || 0);
      await userModel.ensureUsersSchema();
      await client.query(`UPDATE users SET lifetime_savings = lifetime_savings + $1, updated_at = NOW() WHERE id = $2`, [orderSavings, userId]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Must run after COMMIT: createFromCheckoutOrder uses its own connection and reads payment_status.
    // Inside the verify transaction, other connections cannot see the unpaid→paid update (READ COMMITTED).
    await subscriptionService.createFromCheckoutOrder(orderId);
    if (!wasAlreadyPaid) {
      await incrementCouponUsageByCode(couponCodeUsed);
    }
    const orderSummaryRes = await query(
      'SELECT id, order_number, total, delivery_address FROM orders WHERE id = $1',
      [orderId]
    );
    const orderSummary = orderSummaryRes.rows[0] || {};
    
    if (isNationwideDelivery && !wasAlreadyPaid) {
      try {
        const userDetails = await userModel.findById(userId);
        const deliveryAddress = typeof orderSummary.delivery_address === 'string' ? JSON.parse(orderSummary.delivery_address) : orderSummary.delivery_address;
        const shiprocketCustomer = {
          ...(deliveryAddress || {}),
          email: userDetails?.email || '',
        };
        
        // Fetch items for shiprocket
        const itemsRes = await query(
          'SELECT product_id, variation_id, product_name, unit_price, quantity FROM order_items WHERE order_id = $1',
          [orderId]
        );
        
        const shiprocketItems = [];
        for (const row of itemsRes.rows) {
          let weight = 0.1;
          try {
            if (row.variation_id) {
              const vRes = await query('SELECT weight FROM product_variations WHERE id = $1', [row.variation_id]);
              if (vRes.rows[0]?.weight != null) {
                weight = parseFloat(vRes.rows[0].weight);
              }
            } else {
              const pRes = await query('SELECT weight FROM products WHERE id = $1', [row.product_id]);
              if (pRes.rows[0]?.weight != null) {
                weight = parseFloat(pRes.rows[0].weight);
              }
            }
          } catch (e) {
            console.error('[ORDER] Failed to fetch weight for shiprocket item:', e.message);
          }
          
          shiprocketItems.push({
            productId: row.product_id,
            productName: row.product_name,
            unitPrice: row.unit_price,
            quantity: row.quantity,
            weight
          });
        }
        
        const shiprocketOrderData = {
          orderNumber: orderSummary.order_number,
          paymentMethod: 'online',
          total: orderSummary.total
        };
        
        const shiprocketRes = await shiprocketService.createShiprocketOrder(shiprocketOrderData, shiprocketCustomer, shiprocketItems);
        if (shiprocketRes && shiprocketRes.order_id) {
          await query('UPDATE orders SET shiprocket_order_id = $1 WHERE id = $2', [
            String(shiprocketRes.order_id),
            orderId
          ]);
          console.log(`[ORDER] Saved Shiprocket Order ID ${shiprocketRes.order_id} for Online order ${orderSummary.order_number}`);
        }
      } catch (e) {
        console.error('[ORDER] Shiprocket integration failed for Online order:', e?.message || e);
      }
    }

    const itemTypeRes = await query(
      `SELECT 1
       FROM order_items
       WHERE order_id = $1 AND product_name ILIKE 'Subscription for %'
       LIMIT 1`,
      [orderId]
    );
    await notifyAdminsForOrder(
      {
        id: orderSummary.id || orderId,
        orderNumber: orderSummary.order_number || '',
        total: orderSummary.total || 0,
        paymentStatus: 'paid',
      },
      {
        containsSubscription: itemTypeRes.rows.length > 0,
        eventKey: `order:${orderId}:paid`,
      }
    );

    res.json({
      success: true,
      data: { orderId, paymentStatus: 'paid' },
      message: 'Payment verified',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List current user's orders
 * GET /api/orders
 */
const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not found');
    const orders = await orderModel.listOrdersForUser(userId);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

/**
 * Delivered line items for the reviews hub (My Account → Reviews).
 * GET /api/orders/review-deliverables (registered on app in server.js before order router)
 */
const getDeliveredForReview = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not found');
    const items = await orderModel.getDeliveredItemsForReview(userId);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single order by ID (customer's own order only)
 * GET /api/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id: orderId } = req.params;
    if (!userId) throw new ValidationError('User not found');
    if (!orderId) throw new ValidationError('Order ID is required');
    const order = await orderModel.getOrderByIdForUser(userId, orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit order feedback (emoji: least, neutral, most). One per order, locked after submit.
 * POST /api/orders/:id/feedback
 * Body: { rating: 'least'|'neutral'|'most' }
 */
const submitFeedback = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id: orderId } = req.params;
    const { rating } = req.body || {};
    if (!userId) throw new ValidationError('User not found');
    if (!orderId) throw new ValidationError('Order ID is required');
    if (!rating || !['least', 'neutral', 'most'].includes(String(rating))) {
      throw new ValidationError('rating must be one of: least, neutral, most');
    }
    await orderModel.submitOrderFeedback(orderId, userId, String(rating));
    res.json({ success: true, data: { submitted: true } });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit detailed order feedback (How was it? popup).
 * POST /api/orders/:id/detailed-feedback
 * Body: { qualityStars, deliveryAgentStars, onTimeStars, valueForMoneyStars, wouldOrderAgain }
 */
const submitDetailedFeedback = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id: orderId } = req.params;
    const { qualityStars, deliveryAgentStars, onTimeStars, valueForMoneyStars, wouldOrderAgain, productId, comment } = req.body || {};
    if (!userId) throw new ValidationError('User not found');
    if (!orderId) throw new ValidationError('Order ID is required');
    const data = { qualityStars, deliveryAgentStars, onTimeStars, valueForMoneyStars, wouldOrderAgain, productId, comment };
    const result = await orderModel.submitDetailedFeedback(orderId, userId, data);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dynamic checkout fees (delivery charges, platform fees) including Shiprocket quotes.
 * POST /api/orders/checkout-fees
 */
const getCheckoutFees = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { items, deliveryAddress, paymentMethod } = req.body || {};

    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: 'Delivery address is required' });
    }

    const result = await calculateCheckoutFees({
      userId,
      items: Array.isArray(items) ? items : [],
      deliveryAddress,
      paymentMethod: paymentMethod || 'cod',
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate and fetch the Shiprocket order invoice link
 * GET /api/orders/:id/invoice
 */
const getOrderInvoice = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id: orderId } = req.params;
    if (!userId) throw new ValidationError('User not found');
    if (!orderId) throw new ValidationError('Order ID is required');

    const order = await orderModel.getOrderByIdForUser(userId, orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!order.isNationwideDelivery) {
      return res.status(400).json({ success: false, error: 'Invoices can only be generated for nationwide deliveries' });
    }

    let shiprocketOrderId = order.shiprocketOrderId;

    if (!shiprocketOrderId) {
      console.log(`[ORDER] shiprocketOrderId not found in DB for order ${order.orderNumber}. Searching in Shiprocket...`);
      try {
        const searchedId = await shiprocketService.findOrderIdByNumber(order.orderNumber);
        if (searchedId) {
          shiprocketOrderId = String(searchedId);
          await query('UPDATE orders SET shiprocket_order_id = $1 WHERE id = $2', [
            shiprocketOrderId,
            order.id
          ]);
          console.log(`[ORDER] Found and saved Shiprocket Order ID ${shiprocketOrderId} for existing order ${order.orderNumber}`);
        }
      } catch (searchError) {
        console.error('[ORDER] Fallback Shiprocket order search failed:', searchError);
      }
    }

    if (!shiprocketOrderId) {
      return res.status(400).json({ success: false, error: 'Scribble has not created or processed for this order. No worries, Try again soon' });
    }

    const invoiceData = await shiprocketService.getOrderInvoice(shiprocketOrderId);
    res.json({
      success: true,
      data: {
        isInvoiceCreated: invoiceData.is_invoice_created,
        invoiceUrl: invoiceData.invoice_url
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getDeliveredForReview,
  getOrderById,
  verifyPayment,
  submitFeedback,
  submitDetailedFeedback,
  getCheckoutFees,
  getOrderInvoice,
};
