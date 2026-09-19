const subscriptionService = require('../services/subscriptionService');
const { AUTOPAY_FAILURE_MESSAGE } = subscriptionService;
const { verifyWebhookSignature, getPayment } = require('../config/razorpay');
const { ValidationError } = require('../utils/errors');
const { query } = require('../config/database');
const orderModel = require('../models/order');
const adminPushService = require('../services/adminPushNotificationService');

/**
 * Webhook Controller
 * Handles Razorpay webhook events
 */

/**
 * Handle Razorpay webhook
 * POST /api/webhooks/razorpay
 * 
 * Webhook events to handle:
 * - payment.captured: Payment successful, activate subscription
 * - payment.failed: Payment failed, mark subscription as failed
 * - subscription.activated: Subscription activated
 * - subscription.cancelled: Subscription cancelled
 */
const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    
    // req.body is raw buffer from express.raw() middleware
    const webhookBody = req.body.toString();

    // Verify webhook signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
      });
    }

    // Parse JSON body
    const body = JSON.parse(webhookBody);
    const event = body.event;
    const payload = body.payload;

    console.log('Razorpay webhook event:', event);

    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        // Payment successful - activate subscription
        await handlePaymentCaptured(payload);
        break;

      case 'payment.failed':
        // Payment failed - log for admin review
        await handlePaymentFailed(payload);
        break;

      case 'subscription.activated':
        // Subscription activated
        await handleSubscriptionActivated(payload);
        break;

      case 'subscription.cancelled':
        // Subscription cancelled
        await handleSubscriptionCancelled(payload);
        break;

      case 'subscription.charged':
        await handleSubscriptionCharged(payload);
        break;

      case 'subscription.halted':
        await handleSubscriptionHalted(payload);
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    // Always return 200 to acknowledge webhook receipt
    res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent Razorpay from retrying
    res.status(200).json({
      success: false,
      error: 'Webhook processing failed',
    });
  }
};

/**
 * Handle payment captured event
 * Supports: (1) Subscriptions, (2) One-time orders (checkout)
 */
const handlePaymentCaptured = async (payload) => {
  const payment = payload.payment.entity;
  const razorpayOrderId = payment.order_id;

  const { query } = require('../config/database');
  const orderModel = require('../models/order');
  const walletService = require('../services/walletService');

  // 0) Wallet top-up
  if (payment.notes?.wallet_topup === '1' && payment.notes?.user_id) {
    const userId = payment.notes.user_id;
    const amount = Math.round((Number(payment.amount) / 100) * 100) / 100;
    await walletService.creditWallet({
      userId,
      amount,
      source: 'razorpay',
      referenceId: payment.id,
    });
    console.log(`[Razorpay webhook] Wallet credited for user ${userId} (payment ${payment.id})`);
    return;
  }

  // 0b) Razorpay recurring subscription charge → extend same Milko subscription (AutoPay renewal)
  if (payment.subscription_id) {
    const renewed = await subscriptionService.applyAutopaySubscriptionRenewalFromPayment(
      payment.subscription_id,
      payment.id
    );
    if (renewed) {
      console.log(`[Razorpay webhook] AutoPay renewal applied (payment ${payment.id})`);
      return;
    }
  }

  // 1) Subscription rows keyed by Razorpay order id (subscribe flow + trial pack: multiple rows can share one order id)
  const subResult = await query(
    `SELECT id, is_trial
     FROM subscriptions
     WHERE razorpay_subscription_id = $1 AND status = 'pending'
     ORDER BY id ASC`,
    [razorpayOrderId]
  );
  if (subResult.rows.length > 0) {
    for (const row of subResult.rows) {
      const subscriptionId = row.id;
      const wasTrial = row.is_trial === true || row.is_trial === 't';
      const activated = await subscriptionService.activateSubscription(subscriptionId);
      try {
        await adminPushService.notifyAdminsAboutSubscription(
          {
            id: activated?.id,
            userId: activated?.userId,
            productId: activated?.productId,
            productName: activated?.productName,
            status: activated?.status,
          },
          { eventKey: `subscription:${subscriptionId}:active`, isTrial: wasTrial }
        );
      } catch (error) {
        console.error('[Razorpay webhook] Failed to send subscription admin push:', error?.message || error);
      }
      console.log(`[Razorpay webhook] Subscription ${subscriptionId} activated after payment`);
    }
    return;
  }

  // 2) One-time checkout order
  const orderResult = await query(
    'SELECT id FROM orders WHERE razorpay_order_id = $1 AND payment_status = $2',
    [razorpayOrderId, 'pending']
  );
  if (orderResult.rows.length > 0) {
    await orderModel.updatePaymentStatusByRazorpayOrderId(razorpayOrderId, 'paid');
    await subscriptionService.createFromCheckoutOrder(orderResult.rows[0].id);
    try {
      const orderSummaryRes = await query(
        `SELECT id, order_number, total
         FROM orders
         WHERE id = $1`,
        [orderResult.rows[0].id]
      );
      const orderSummary = orderSummaryRes.rows[0] || {};
      const itemTypeRes = await query(
        `SELECT 1
         FROM order_items
         WHERE order_id = $1 AND product_name ILIKE 'Subscription for %'
         LIMIT 1`,
        [orderResult.rows[0].id]
      );
      await adminPushService.notifyAdminsAboutOrder(
        {
          id: orderSummary.id || orderResult.rows[0].id,
          orderNumber: orderSummary.order_number || '',
          total: orderSummary.total || 0,
          paymentStatus: 'paid',
          containsSubscription: itemTypeRes.rows.length > 0,
        },
        { eventKey: `order:${orderResult.rows[0].id}:paid` }
      );
    } catch (error) {
      console.error('[Razorpay webhook] Failed to send order admin push:', error?.message || error);
    }
    console.log(`[Razorpay webhook] Order ${orderResult.rows[0].id} marked paid`);
  }
};

/**
 * Handle payment failed event
 */
const handlePaymentFailed = async (payload) => {
  const payment = payload.payment.entity;
  console.log('Payment failed:', payment.id, payment.error_description);
  // Log for admin review - could send notification
};

/**
 * Recurring subscription charge succeeded (same as payment.captured for subscription payments).
 */
const handleSubscriptionCharged = async (payload) => {
  const payment = payload.payment?.entity;
  const sub = payload.subscription?.entity;
  if (!payment?.id || !sub?.id) return;
  const renewed = await subscriptionService.applyAutopaySubscriptionRenewalFromPayment(sub.id, payment.id);
  if (renewed) {
    console.log(`[Razorpay webhook] subscription.charged applied for ${sub.id}`);
  }
};

/**
 * Recurring charge exhausted Razorpay retries → expire Milko subscription (renewal window only).
 * Does not apply to mid-period mandate setup failures (those never hit halted in our start_at flow).
 */
const handleSubscriptionHalted = async (payload) => {
  const sub = payload.subscription?.entity;
  if (!sub?.id) return;
  const { query } = require('../config/database');
  const result = await query(
    `UPDATE subscriptions
     SET status = 'expired',
         autopay_status = 'halted',
         autopay_failure_reason = $1,
         updated_at = NOW()
     WHERE razorpay_subscription_id = $2 AND status IN ('active', 'paused')`,
    [AUTOPAY_FAILURE_MESSAGE, sub.id]
  );
  if (result.rowCount > 0) {
    console.log(`[Razorpay webhook] subscription.halted → expired Milko row for ${sub.id}`);
  }
};

/**
 * Handle subscription activated event
 */
const handleSubscriptionActivated = async (payload) => {
  const subscription = payload.subscription.entity;
  console.log('Subscription activated:', subscription.id);
  
  const { query } = require('../config/database');
  await query(
    `UPDATE subscriptions SET autopay_status = 'active', updated_at = NOW() WHERE razorpay_subscription_id = $1`,
    [subscription.id]
  );
};

/**
 * Handle subscription cancelled event
 */
const handleSubscriptionCancelled = async (payload) => {
  const subscription = payload.subscription.entity;
  console.log('Subscription cancelled:', subscription.id);
  
  // Update subscription status in database
  const { query } = require('../config/database');
  await query(
    'UPDATE subscriptions SET status = $1, autopay_status = $2, updated_at = NOW() WHERE razorpay_subscription_id = $3',
    ['cancelled', 'cancelled', subscription.id]
  );
};

/**
 * Handle Shiprocket webhook
 * POST /api/webhooks/shiprocket
 */
const handleShiprocketWebhook = async (req, res, next) => {
  try {
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
    const providedToken = req.headers['x-api-key'];
    const payload = req.body;

    // Detect if this is a test request from the Shiprocket dashboard
    const isTestRequest = 
      payload?.channel_order_id === 'enter your channel order id' || 
      payload?.channel === 'enter your channel name' ||
      payload?.courier_name === 'enter courier_name';

    if (expectedToken && providedToken !== expectedToken && !isTestRequest) {
      console.warn('Shiprocket webhook failed auth: invalid x-api-key');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (isTestRequest) {
      console.log('Shiprocket test webhook successfully verified');
      return res.status(200).json({ success: true, message: 'Test webhook verified successfully' });
    }

    console.log('Shiprocket webhook received:', payload?.current_status, payload?.channel_order_id);

    const orderNumber = payload?.channel_order_id;
    const currentStatus = (payload?.current_status || '').toUpperCase();

    if (!orderNumber) {
      return res.status(200).json({ success: true, message: 'No channel_order_id' });
    }

    let newStatus = null;
    let timestampCol = null;

    if (currentStatus === 'SHIPPED') { newStatus = 'shipped'; timestampCol = 'shipped_at'; }
    if (currentStatus === 'IN TRANSIT') { newStatus = 'in_transit'; timestampCol = 'in_transit_at'; }
    if (currentStatus === 'REACHED DESTINATION' || currentStatus === 'AT DESTINATION HUB') { newStatus = 'reached_destination_hub'; timestampCol = 'reached_destination_hub_at'; }
    if (currentStatus === 'OUT FOR DELIVERY') { newStatus = 'out_for_delivery'; timestampCol = 'out_for_delivery_at'; }
    if (currentStatus === 'DELIVERED') { newStatus = 'delivered'; timestampCol = 'delivered_at'; }
    if (currentStatus === 'CANCELED' || currentStatus === 'CANCELLED') newStatus = 'cancelled';
    if (currentStatus === 'RTO DELIVERED') newStatus = 'cancelled'; 

    const awb = payload?.awb;
    const courier = payload?.courier_name;

    if (newStatus || awb || courier) {
      const { query } = require('../config/database');
      
      let updateQuery = `UPDATE orders SET updated_at = NOW()`;
      const values = [orderNumber];
      let valIdx = 2;
      
      if (newStatus) {
        updateQuery += `, status = $${valIdx}`;
        values.push(newStatus);
        valIdx++;
        
        if (timestampCol) {
          updateQuery += `, ${timestampCol} = NOW()`;
        }
        if (newStatus === 'delivered') {
          updateQuery += `, fulfilled_at = NOW()`;
        }
      }
      
      if (awb) {
        updateQuery += `, shiprocket_awb = $${valIdx}`;
        values.push(awb);
        valIdx++;
      }
      if (courier) {
        updateQuery += `, shiprocket_courier = $${valIdx}`;
        values.push(courier);
        valIdx++;
      }
      
      updateQuery += ` WHERE order_number = $1`;
      
      if (newStatus) {
        updateQuery += ` AND status != 'delivered' AND status != 'cancelled' AND status != 'refunded'`;
      }
      
      await query(updateQuery, values);
      console.log(`[Shiprocket Webhook] Order ${orderNumber} processed (status: ${newStatus || 'unchanged'}, AWB: ${awb || 'N/A'})`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Shiprocket webhook error:', error);
    res.status(200).json({ success: false, error: 'Webhook processing failed' });
  }
};

module.exports = {
  handleRazorpayWebhook,
  handleShiprocketWebhook,
};
