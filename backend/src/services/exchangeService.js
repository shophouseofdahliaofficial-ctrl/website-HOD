const exchangeModel = require('../models/exchange');
const orderModel = require('../models/order');
const { query } = require('../config/database');
const { ValidationError } = require('../utils/errors');
const walletService = require('./walletService');
const adminPushService = require('./adminPushNotificationService');
const delhiveryService = require('./delhiveryService');
const { hasRazorpayKeys, createOrder: createRazorpayOrder, getPayment: getRazorpayPayment } = require('../config/razorpay');
const crypto = require('crypto');

const EXCHANGE_WINDOW_DAYS = 7;

function isWithinExchangeWindow(deliveredAt) {
  if (!deliveredAt) return true;
  const deliveredTime = new Date(deliveredAt).getTime();
  if (isNaN(deliveredTime)) return true;
  const maxAllowedTime = deliveredTime + EXCHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() <= maxAllowedTime;
}

async function resolveOriginalVariation(orderId, itemId, productId, passedVariation) {
  if (passedVariation && String(passedVariation).trim()) {
    return String(passedVariation).trim();
  }

  try {
    let itemQuery = `SELECT * FROM order_items WHERE order_id::text = $1::text`;
    const itemParams = [String(orderId)];
    if (itemId) {
      itemQuery += ` AND id::text = $2::text`;
      itemParams.push(String(itemId));
    } else if (productId) {
      itemQuery += ` AND product_id::text = $2::text`;
      itemParams.push(String(productId));
    }
    itemQuery += ` ORDER BY id ASC LIMIT 1`;

    const itemRes = await query(itemQuery, itemParams);
    if (itemRes.rows.length > 0) {
      const item = itemRes.rows[0];
      const prodId = item.product_id;
      const cust = typeof item.customizations === 'string' ? JSON.parse(item.customizations) : item.customizations || {};
      const custData = typeof item.customization_data === 'string' ? JSON.parse(item.customization_data) : item.customization_data || {};
      const selectedOpts = cust.selectedOptions || custData.selectedOptions || cust.options || null;

      if (prodId && selectedOpts && typeof selectedOpts === 'object') {
        const prodRes = await query(`SELECT customization_options, variations FROM products WHERE id::text = $1::text`, [String(prodId)]);
        if (prodRes.rows.length > 0) {
          const p = prodRes.rows[0];
          const custOptions = typeof p.customization_options === 'string' ? JSON.parse(p.customization_options) : p.customization_options || [];
          const parts = [];
          for (const [groupId, valId] of Object.entries(selectedOpts)) {
            const group = custOptions.find((g) => String(g.id) === String(groupId) || String(g.title || '').toLowerCase() === String(groupId).toLowerCase());
            const val = group ? (group.values || []).find((v) => String(v.id) === String(valId) || String(v.name || '').toLowerCase() === String(valId).toLowerCase()) : null;
            if (group && val) {
              parts.push(`${group.title}: ${val.name}`);
            } else if (valId) {
              parts.push(String(valId));
            }
          }
          if (parts.length > 0) return parts.join(', ');
        }
      }

      if (item.variation_size) return item.variation_size;
      if (cust.variationSize || cust.size) return cust.variationSize || cust.size;
    }
  } catch (err) {
    console.warn('[exchangeService] Failed to auto-resolve original variation:', err.message);
  }

  return null;
}

async function scheduleDelhiveryReversePickup(exchange) {
  if (exchange.reverseWaybill) {
    return {
      reverseWaybill: exchange.reverseWaybill,
      reverseStatus: exchange.reverseStatus,
      reverseTrackingUrl: exchange.reverseTrackingUrl,
      reversePickupScheduledAt: exchange.reversePickupScheduledAt,
    };
  }

  try {
    const fullOrder = await orderModel.getOrderByIdForAdmin(exchange.orderId);
    const deliveryAddress = fullOrder?.deliveryAddress || fullOrder?.shipping_address || fullOrder?.delivery_address;

    const rvpRes = await delhiveryService.createReversePickupOrder({
      exchange,
      order: fullOrder || { orderNumber: exchange.orderNumber, id: exchange.orderId },
      customer: deliveryAddress || {
        name: exchange.customerName,
        phone: exchange.customerPhone,
        address: 'Customer Address',
      },
    });

    if (rvpRes && (rvpRes.waybill || rvpRes.success)) {
      return {
        reverseWaybill: rvpRes.waybill || null,
        reverseStatus: rvpRes.status || 'Reverse Pickup Scheduled',
        reverseTrackingUrl: rvpRes.trackingUrl || (rvpRes.waybill ? `https://www.delhivery.com/track/package/${rvpRes.waybill}` : null),
        reversePickupScheduledAt: new Date(),
      };
    }
  } catch (rvpErr) {
    console.warn('[exchangeService] Reverse pickup initiation warning:', rvpErr.message || rvpErr);
  }

  return {};
}

async function syncDelhiveryStatusForExchange(exchange) {
  if (!exchange) return exchange;
  let currentExchange = exchange;

  // 1. Automated Replacement Delivery Step
  if (currentExchange.replacementWaybill && !currentExchange.replacementDeliveredAt) {
    try {
      const trackRes = await delhiveryService.trackDelhiveryShipment(currentExchange.replacementWaybill);
      if (trackRes && trackRes.success) {
        const rawStatus = String(trackRes.status || '').toUpperCase();
        const statusType = String(trackRes.statusType || '').toUpperCase();

        if (rawStatus === 'DELIVERED' || rawStatus.includes('DELIVERED') || rawStatus === 'DL' || statusType === 'DL') {
          const deliveredDate = trackRes.statusDateTime ? new Date(trackRes.statusDateTime) : new Date();
          currentExchange = await exchangeModel.markReplacementDelivered(currentExchange.id, {
            deliveredAt: deliveredDate,
          });
          console.log(`[Exchange Sync] Automatically marked replacement delivered for #${currentExchange.orderNumber} (AWB: ${currentExchange.replacementWaybill})`);
        } else if (rawStatus && rawStatus !== currentExchange.replacementStatus) {
          let mappedStatus = rawStatus;
          if (rawStatus === 'OUT FOR DELIVERY' || statusType === 'OFD') mappedStatus = 'Out for Delivery';
          else if (rawStatus === 'IN TRANSIT' || statusType === 'UD') mappedStatus = 'In Transit';

          await query(
            `UPDATE order_exchanges SET replacement_status = $1, updated_at = NOW() WHERE id = $2`,
            [mappedStatus, currentExchange.id]
          );
          currentExchange.replacementStatus = mappedStatus;
        }
      }
    } catch (e) {
      console.warn(`[Exchange Tracking] Failed to sync replacement tracking for ${currentExchange.id}:`, e.message);
    }
  }

  // 2. Automated Return Warehouse Arrival Step
  if (currentExchange.reverseWaybill && !currentExchange.returnReceivedAt) {
    try {
      const trackRes = await delhiveryService.trackDelhiveryShipment(currentExchange.reverseWaybill);
      if (trackRes && trackRes.success) {
        const rawStatus = String(trackRes.status || '').toUpperCase();
        const statusType = String(trackRes.statusType || '').toUpperCase();

        if (rawStatus === 'DELIVERED' || rawStatus.includes('DELIVERED') || rawStatus === 'DL' || statusType === 'DL' || rawStatus.includes('RTO DELIVERED')) {
          const receivedDate = trackRes.statusDateTime ? new Date(trackRes.statusDateTime) : new Date();
          currentExchange = await exchangeModel.markReturnReceived(currentExchange.id, {
            receivedAt: receivedDate,
          });
          console.log(`[Exchange Sync] Automatically marked return package received at warehouse for #${currentExchange.orderNumber} (AWB: ${currentExchange.reverseWaybill})`);
        }
      }
    } catch (e) {
      console.warn(`[Exchange Tracking] Failed to sync reverse pickup tracking for ${currentExchange.id}:`, e.message);
    }
  }

  return currentExchange;
}

const exchangeService = {
  syncDelhiveryStatusForExchange,
  async requestExchange(userId, data) {
    const {
      orderId,
      itemId,
      productId,
      productName,
      originalVariation,
      originalUnitPrice = 0,
      quantity = 1,
      requestedItemName,
      requestedVariation,
      requestedUnitPrice = 0,
      reason,
      customerMessage,
    } = data;

    if (!orderId) {
      throw new ValidationError('Order ID is required');
    }
    if (!reason || !reason.trim()) {
      throw new ValidationError('Reason for exchange is required');
    }

    // Fetch order to verify
    const orderRes = await query(
      `SELECT * FROM orders WHERE id::text = $1::text AND user_id::text = $2::text`,
      [String(orderId), String(userId)]
    );

    if (orderRes.rows.length === 0) {
      throw new ValidationError('Order not found or does not belong to you');
    }

    const order = orderRes.rows[0];

    // Must be delivered
    if (order.status !== 'delivered') {
      throw new ValidationError('Exchanges can only be requested after the order is delivered');
    }

    // 7-day window check
    const deliveredAt = order.delivered_at || order.delivery_date;
    if (deliveredAt && !isWithinExchangeWindow(deliveredAt)) {
      throw new ValidationError(
        'Exchange window has expired. Exchanges must be requested within 7 days of delivery.'
      );
    }

    // Check if an existing active exchange exists
    const existing = await exchangeModel.getExchangeByOrderId(order.id, userId);
    if (existing && (existing.status === 'pending' || existing.status === 'approved' || existing.status === 'completed')) {
      throw new ValidationError(
        `An exchange request for this order is already ${existing.status}.`
      );
    }

    let exchange;

    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      // Multi-item exchange request
      const processedItems = [];
      let totalDiff = 0;
      let totalQty = 0;
      let totalOrigPrice = 0;
      let totalReqPrice = 0;

      for (const it of data.items) {
        const origPrice = Number(it.originalUnitPrice) || 0;
        const reqPrice = Number(it.requestedUnitPrice) > 0 ? Number(it.requestedUnitPrice) : origPrice;
        const qty = Number(it.quantity) || 1;
        const lineDiff = Math.round((reqPrice - origPrice) * qty * 100) / 100;
        const resolvedOrigVar = await resolveOriginalVariation(order.id, it.itemId, it.productId, it.originalVariation);

        totalDiff += lineDiff;
        totalQty += qty;
        totalOrigPrice += origPrice * qty;
        totalReqPrice += reqPrice * qty;

        processedItems.push({
          itemId: it.itemId || null,
          productId: it.productId || null,
          productName: it.productName || 'Product',
          originalVariation: resolvedOrigVar,
          originalUnitPrice: origPrice,
          quantity: qty,
          requestedItemName: it.requestedItemName || it.productName || 'Product',
          requestedVariation: it.requestedVariation || null,
          requestedUnitPrice: reqPrice,
          priceDifference: lineDiff,
          reason: (it.reason || reason).trim(),
        });
      }

      totalDiff = Math.round(totalDiff * 100) / 100;

      const summaryProductName = processedItems.map((i) => i.productName).join(', ');
      const summaryOrigVar = processedItems.map((i) => `${i.productName}: ${i.originalVariation || 'Standard'}`).join(' | ');
      const summaryReqVar = processedItems.map((i) => `${i.productName}: ${i.requestedVariation || 'Standard'}`).join(' | ');

      exchange = await exchangeModel.createExchange({
        orderId: order.id,
        userId,
        orderNumber: order.order_number,
        itemId: processedItems[0]?.itemId || null,
        productId: processedItems[0]?.productId || null,
        productName: summaryProductName,
        originalVariation: summaryOrigVar,
        originalUnitPrice: totalOrigPrice,
        quantity: totalQty,
        requestedItemName: summaryProductName,
        requestedVariation: summaryReqVar,
        requestedUnitPrice: totalReqPrice,
        priceDifference: totalDiff,
        exchangeItems: processedItems,
        reason: reason.trim(),
        customerMessage: (customerMessage || '').trim(),
      });
    } else {
      // Single-item fallback
      const origPrice = Number(originalUnitPrice) || 0;
      const reqPrice = Number(requestedUnitPrice) > 0 ? Number(requestedUnitPrice) : origPrice;
      const qty = Number(quantity) || 1;
      const priceDifference = Math.round((reqPrice - origPrice) * qty * 100) / 100;

      const resolvedOriginalVar = await resolveOriginalVariation(order.id, itemId, productId, originalVariation);

      const singleItem = {
        itemId: itemId || null,
        productId: productId || null,
        productName: productName || 'Product',
        originalVariation: resolvedOriginalVar,
        originalUnitPrice: origPrice,
        quantity: qty,
        requestedItemName: requestedItemName || productName,
        requestedVariation,
        requestedUnitPrice: reqPrice,
        priceDifference,
        reason: reason.trim(),
      };

      exchange = await exchangeModel.createExchange({
        orderId: order.id,
        userId,
        orderNumber: order.order_number,
        itemId,
        productId,
        productName: productName || 'Product',
        originalVariation: resolvedOriginalVar,
        originalUnitPrice: origPrice,
        quantity: qty,
        requestedItemName: requestedItemName || productName,
        requestedVariation,
        requestedUnitPrice: reqPrice,
        priceDifference,
        exchangeItems: [singleItem],
        reason: reason.trim(),
        customerMessage: (customerMessage || '').trim(),
      });
    }

    // Notify admin
    try {
      if (adminPushService && typeof adminPushService.notifyAdminsAboutOrder === 'function') {
        adminPushService.notifyAdminsAboutOrder({
          order_number: order.order_number,
          title: `New Exchange Request: #${order.order_number}`,
          body: `Customer requested an exchange for ${productName || 'items'}. Reason: ${reason}`,
          total: priceDifference,
        });
      }
    } catch (e) {
      console.warn('[EXCHANGE] Admin push error:', e?.message || e);
    }

    return exchange;
  },

  async getExchangeForOrder(orderId, userId = null) {
    let exchange = await exchangeModel.getExchangeByOrderId(orderId, userId);
    if (exchange) {
      exchange = await syncDelhiveryStatusForExchange(exchange);
      if (!exchange.originalVariation) {
        exchange.originalVariation = await resolveOriginalVariation(exchange.orderId, exchange.itemId, exchange.productId, null);
      }
    }
    return exchange;
  },

  async getExchangeById(id) {
    let exchange = await exchangeModel.getExchangeById(id);
    if (!exchange) throw new ValidationError('Exchange request not found');
    exchange = await syncDelhiveryStatusForExchange(exchange);
    if (!exchange.originalVariation) {
      exchange.originalVariation = await resolveOriginalVariation(exchange.orderId, exchange.itemId, exchange.productId, null);
    }
    return exchange;
  },

  async getAllExchanges(params) {
    const res = await exchangeModel.getAllExchanges(params);
    if (res && Array.isArray(res.exchanges)) {
      for (let i = 0; i < res.exchanges.length; i++) {
        let ex = res.exchanges[i];
        if (ex.replacementWaybill && !ex.replacementDeliveredAt) {
          ex = await syncDelhiveryStatusForExchange(ex);
          res.exchanges[i] = ex;
        }
        if (!ex.originalVariation) {
          ex.originalVariation = await resolveOriginalVariation(ex.orderId, ex.itemId, ex.productId, null);
        }
      }
    }
    return res;
  },

  async getPendingCount() {
    return exchangeModel.getPendingCount();
  },

  async approveExchange(id, { priceDifference, requestedVariation, requestedUnitPrice, approvalMessage, adminNote } = {}) {
    const exchange = await exchangeModel.getExchangeById(id);
    if (!exchange) throw new ValidationError('Exchange request not found');
    if (exchange.status !== 'pending') {
      throw new ValidationError(`Exchange request is already ${exchange.status}`);
    }

    const diff = priceDifference !== undefined ? Number(priceDifference) : exchange.priceDifference;

    // If price difference is 0 or negative (refund), schedule pickup immediately on approval.
    // If price difference > 0, customer must pay and settle FIRST before Delhivery reverse pickup is scheduled.
    let rvpDetails = {};
    if (diff === 0 || Math.abs(diff) < 0.01) {
      rvpDetails = await scheduleDelhiveryReversePickup(exchange);
    }

    const updated = await exchangeModel.approveExchange(id, {
      priceDifference: diff,
      requestedVariation: requestedVariation !== undefined ? requestedVariation : exchange.requestedVariation,
      requestedUnitPrice: requestedUnitPrice !== undefined ? Number(requestedUnitPrice) : exchange.requestedUnitPrice,
      approvalMessage: approvalMessage !== undefined ? approvalMessage.trim() : undefined,
      adminNote,
      reverseWaybill: rvpDetails.reverseWaybill,
      reverseStatus: rvpDetails.reverseStatus,
      reverseTrackingUrl: rvpDetails.reverseTrackingUrl,
      reversePickupScheduledAt: rvpDetails.reversePickupScheduledAt,
    });

    return updated;
  },

  async rejectExchange(id, { rejectionReason, adminNote }) {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new ValidationError('A rejection reason is required');
    }

    const exchange = await exchangeModel.getExchangeById(id);
    if (!exchange) throw new ValidationError('Exchange request not found');
    if (exchange.status !== 'pending') {
      throw new ValidationError(`Exchange request is already ${exchange.status}`);
    }

    const updated = await exchangeModel.rejectExchange(id, {
      rejectionReason: rejectionReason.trim(),
      adminNote,
    });

    return updated;
  },

  async createExchangeOnlinePaymentOrder(userId, exchangeId) {
    const exchange = await exchangeModel.getExchangeById(exchangeId);
    if (!exchange) throw new ValidationError('Exchange request not found');
    if (String(exchange.userId) !== String(userId)) {
      throw new ValidationError('Access denied');
    }
    if (exchange.status !== 'approved') {
      throw new ValidationError('Exchange must be approved to initiate payment');
    }
    if (exchange.priceDifference <= 0) {
      throw new ValidationError('No additional payment required for this exchange');
    }

    const amountInRupees = exchange.priceDifference;

    if (!hasRazorpayKeys) {
      throw new ValidationError(
        'Online payment gateway is not configured (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing). Please configure Razorpay credentials in backend environment or use wallet.'
      );
    }

    const razorpayOrder = await createRazorpayOrder({
      amount: Math.round(amountInRupees * 100),
      currency: 'INR',
      receipt: `exch_${exchange.id.slice(0, 10)}`,
      notes: {
        exchangeId: exchange.id,
        orderNumber: exchange.orderNumber,
        userId: String(userId),
      },
    });

    return {
      razorpayOrderId: razorpayOrder.id,
      key: process.env.RAZORPAY_KEY_ID,
      currency: razorpayOrder.currency,
      amount: amountInRupees,
      exchangeId: exchange.id,
    };
  },

  async settleOrPayExchange(userId, data) {
    const { exchangeId, paymentMethod, razorpayPaymentId, razorpayOrderId, razorpaySignature } = data;
    const exchange = await exchangeModel.getExchangeById(exchangeId);
    if (!exchange) throw new ValidationError('Exchange request not found');
    if (String(exchange.userId) !== String(userId)) {
      throw new ValidationError('Access denied');
    }
    if (exchange.status !== 'approved') {
      throw new ValidationError(`Exchange is currently ${exchange.status}, cannot settle payment`);
    }

    const priceDiff = exchange.priceDifference;

    // Case 1: Same price difference (0)
    if (priceDiff === 0 || Math.abs(priceDiff) < 0.01) {
      const rvp = await scheduleDelhiveryReversePickup(exchange);
      const completed = await exchangeModel.completeExchangePayment(exchange.id, {
        paymentStatus: 'not_required',
        paymentMethod: 'free',
        paymentReference: 'no_difference',
        ...rvp,
      });
      return { exchange: completed, message: 'Exchange settled with no price difference' };
    }

    // Case 2: Customer is owed a refund (negative difference)
    if (priceDiff < 0) {
      const refundAmount = Math.abs(priceDiff);
      const creditRes = await walletService.creditWallet({
        userId,
        amount: refundAmount,
        source: 'Exchange refund',
        referenceId: `exchange_${exchange.id}`,
      });

      const rvp = await scheduleDelhiveryReversePickup(exchange);
      const completed = await exchangeModel.completeExchangePayment(exchange.id, {
        paymentStatus: 'refunded',
        paymentMethod: 'wallet_refund',
        paymentReference: `wallet_credit_${exchange.id}`,
        ...rvp,
      });

      return {
        exchange: completed,
        walletBalance: creditRes.balance,
        message: `₹${refundAmount.toFixed(2)} credited to your wallet`,
      };
    }

    // Case 3: Customer must pay (positive difference) - Wallet
    if (paymentMethod === 'wallet') {
      const debitRes = await walletService.debitWallet({
        userId,
        amount: priceDiff,
        source: 'Exchange payment',
        referenceId: `exchange_${exchange.id}`,
      });

      const rvp = await scheduleDelhiveryReversePickup(exchange);
      const completed = await exchangeModel.completeExchangePayment(exchange.id, {
        paymentStatus: 'paid',
        paymentMethod: 'wallet',
        paymentReference: `wallet_debit_${exchange.id}`,
        ...rvp,
      });

      return {
        exchange: completed,
        walletBalance: debitRes.balance,
        message: `₹${priceDiff.toFixed(2)} paid from your wallet`,
      };
    }

    // Case 4: Customer must pay (positive difference) - Online
    if (paymentMethod === 'online') {
      if (!hasRazorpayKeys) {
        throw new ValidationError('Online payment gateway is not configured (Razorpay keys missing).');
      }

      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        throw new ValidationError('Missing required Razorpay payment verification details.');
      }

      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        throw new ValidationError('Invalid payment signature');
      }

      const rvp = await scheduleDelhiveryReversePickup(exchange);
      const completed = await exchangeModel.completeExchangePayment(exchange.id, {
        paymentStatus: 'paid',
        paymentMethod: 'online',
        paymentReference: razorpayPaymentId,
        ...rvp,
      });

      return {
        exchange: completed,
        message: `₹${priceDiff.toFixed(2)} paid successfully online`,
      };
    }

    throw new ValidationError('Invalid payment method selected');
  },

  async markReturnReceived(id, { adminNote } = {}) {
    const exchange = await exchangeModel.getExchangeById(id);
    if (!exchange) throw new ValidationError('Exchange request not found');
    if (exchange.status !== 'approved' && exchange.status !== 'completed') {
      throw new ValidationError(`Cannot mark return received for an exchange in '${exchange.status}' status`);
    }

    const updated = await exchangeModel.markReturnReceived(id, { adminNote });
    return updated;
  },

  async markReturnVerified(id, { adminNote } = {}) {
    const exchange = await exchangeModel.getExchangeById(id);
    if (!exchange) throw new ValidationError('Exchange request not found');
    if (exchange.status !== 'approved' && exchange.status !== 'completed') {
      throw new ValidationError(`Cannot verify return for an exchange in '${exchange.status}' status`);
    }
    if (!exchange.returnReceivedAt) {
      throw new ValidationError('Item must be marked as received at origin warehouse before quality verification can be completed');
    }

    const updated = await exchangeModel.markReturnVerified(id, { adminNote });
    return updated;
  },

  async dispatchReplacementOrder(id, { adminNote } = {}) {
    const exchange = await exchangeModel.getExchangeById(id);
    if (!exchange) throw new ValidationError('Exchange request not found');
    if (exchange.status !== 'approved' && exchange.status !== 'completed') {
      throw new ValidationError(`Cannot dispatch replacement for an exchange in '${exchange.status}' status`);
    }

    if (!exchange.returnReceivedAt) {
      throw new ValidationError('Cannot dispatch replacement: Return package has not yet arrived at origin warehouse.');
    }

    if (!exchange.returnVerifiedAt) {
      throw new ValidationError('Cannot dispatch replacement: Return package must pass quality verification first.');
    }

    if (exchange.replacementWaybill) {
      throw new ValidationError(`Replacement order has already been dispatched (AWB: ${exchange.replacementWaybill})`);
    }

    // Fetch customer delivery address
    const fullOrder = await orderModel.getOrderByIdForAdmin(exchange.orderId);
    const deliveryAddress = fullOrder?.deliveryAddress || fullOrder?.shipping_address || fullOrder?.delivery_address;

    const replacementOrderNumber = `EXCH-${exchange.orderNumber}-${Date.now().toString().slice(-4)}`;

    const replacementItems = (exchange.exchangeItems && Array.isArray(exchange.exchangeItems) && exchange.exchangeItems.length > 0)
      ? exchange.exchangeItems.map((it) => ({
          productName: it.requestedItemName || it.productName,
          variationSize: it.requestedVariation || 'Standard',
          quantity: it.quantity || 1,
          unitPrice: it.requestedUnitPrice || 0,
          weight: 0.5,
        }))
      : [
          {
            productName: exchange.requestedItemName || exchange.productName,
            variationSize: exchange.requestedVariation || 'Standard',
            quantity: exchange.quantity || 1,
            unitPrice: exchange.requestedUnitPrice || 0,
            weight: 0.5,
          },
        ];

    const forwardRes = await delhiveryService.createDelhiveryOrder({
      order: {
        orderNumber: replacementOrderNumber,
        total: 0,
        subtotal: 0,
        paymentMethod: 'prepaid',
        created_at: new Date().toISOString(),
      },
      customer: deliveryAddress || {
        name: exchange.customerName || 'Customer',
        phone: exchange.customerPhone || '9999999999',
        address: 'Customer Address',
      },
      items: replacementItems,
    });

    let waybill = null;
    let status = 'Dispatched';
    let trackingUrl = null;

    if (forwardRes && (forwardRes.waybill || forwardRes.success)) {
      waybill = forwardRes.waybill || `FWD${Date.now().toString().slice(-8)}`;
      status = forwardRes.status || 'Dispatched';
      trackingUrl = forwardRes.trackingUrl || `https://www.delhivery.com/track/package/${waybill}`;
    } else {
      // Fallback
      waybill = `FWD${Date.now().toString().slice(-8)}`;
      status = 'Dispatched (Test Mode)';
      trackingUrl = `https://www.delhivery.com/track/package/${waybill}`;
    }

    const updated = await exchangeModel.dispatchReplacement(id, {
      replacementWaybill: waybill,
      replacementStatus: status,
      replacementTrackingUrl: trackingUrl,
      adminNote,
    });

    return updated;
  },

  async markReplacementDelivered(id, { deliveredAt, adminNote } = {}) {
    const exchange = await exchangeModel.getExchangeById(id);
    if (!exchange) throw new ValidationError('Exchange request not found');

    const updated = await exchangeModel.markReplacementDelivered(id, { deliveredAt, adminNote });
    return updated;
  },
};

module.exports = exchangeService;
