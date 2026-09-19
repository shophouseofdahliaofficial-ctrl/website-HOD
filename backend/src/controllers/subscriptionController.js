const subscriptionService = require('../services/subscriptionService');
const subscriptionModel = require('../models/subscription');
const adminPushService = require('../services/adminPushNotificationService');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { getPayment: getRazorpayPayment } = require('../config/razorpay');

async function notifyAdminsForSubscription(subscription, eventKey, extra = {}) {
  try {
    await adminPushService.notifyAdminsAboutSubscription(
      {
        id: subscription?.id,
        userId: subscription?.userId,
        productId: subscription?.productId,
        productName: subscription?.productName,
        status: subscription?.status,
      },
      { eventKey, ...extra }
    );
  } catch (error) {
    console.error('[SUBSCRIPTION] Failed to send admin push:', error?.message || error);
  }
}

async function notifyAdminsForOrder(order, options = {}) {
  try {
    await adminPushService.notifyAdminsAboutOrder(order, options);
  } catch (error) {
    console.error('[SUBSCRIPTION] Failed to send admin order push:', error?.message || error);
  }
}

/**
 * Subscription Controller
 * Handles subscription HTTP requests
 */

/**
 * Get all subscriptions for current user
 * GET /api/subscriptions
 */
const getMySubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await subscriptionModel.getSubscriptionsByUserId(req.user.id);

    res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription by ID
 * GET /api/subscriptions/:id
 */
const getSubscriptionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionModel.getSubscriptionByIdForUser(id, req.user.id);
    if (!subscription) {
      throw new NotFoundError('Subscription');
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
 * Create new subscription
 * POST /api/subscriptions
 */
const createSubscription = async (req, res, next) => {
  try {
    const {
      productId,
      variationId,
      variation_id: variationIdLegacy,
      productVariationId,
      product_variation_id: productVariationIdLegacy,
      litresPerDay,
      durationMonths,
      durationDays,
      deliveryTime,
      paymentMethod,
      addressId,
      trialSubscriptionId,
      frequency,
    } =
      req.body;
    const resolvedVariationId =
      variationId ?? variationIdLegacy ?? productVariationId ?? productVariationIdLegacy ?? null;

    if (!productId || !litresPerDay || !deliveryTime) {
      throw new ValidationError('All fields are required');
    }
    const hasDuration =
      (durationDays != null && durationDays !== '' && Number(durationDays) >= 1) ||
      (durationMonths != null && durationMonths !== '' && Number(durationMonths) >= 1);
    if (!hasDuration) {
      throw new ValidationError('Duration is required (durationDays or durationMonths)');
    }
    const method = (paymentMethod || 'wallet').toString().toLowerCase();
    if (trialSubscriptionId && method === 'cod') {
      throw new ValidationError('Converting a trial to a full plan requires online payment (COD is not available for this step)');
    }
    if (method !== 'wallet' && method !== 'online') {
      throw new ValidationError('Invalid payment method');
    }

    const result = await subscriptionService.createSubscription({
      userId: req.user.id,
      productId,
      variationId: resolvedVariationId,
      litresPerDay,
      durationMonths,
      durationDays,
      deliveryTime,
      paymentMethod: method,
      addressId: addressId || null,
      trialSubscriptionId: trialSubscriptionId || null,
      frequency,
    });

    if (!result?.razorpayOrder && result?.subscription?.id) {
      await notifyAdminsForSubscription(result.subscription, `subscription:${result.subscription.id}:active`);
    }

    res.status(201).json({
      success: true,
      data: result,
      message: 'Subscription created. Please complete payment.',
    });
  } catch (error) {
    next(error);
  }
};

const estimateTrialPack = async (req, res, next) => {
  try {
    const { items, addressId, deliveryTime } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one trial item is required');
    }
    if (!addressId) {
      throw new ValidationError('addressId is required');
    }
    const data = await subscriptionService.estimateTrialPack({
      userId: req.user.id,
      items,
      addressId,
      deliveryTime: deliveryTime || null,
    });
    res.json({ success: true, data, message: 'Trial pack checkout estimate' });
  } catch (error) {
    next(error);
  }
};

const createTrialPack = async (req, res, next) => {
  try {
    const { items, addressId, deliveryTime, paymentMethod } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one trial item is required');
    }
    if (!addressId || !deliveryTime) {
      throw new ValidationError('addressId and deliveryTime are required');
    }
    const pm = (paymentMethod || 'online').toString().toLowerCase();
    if (pm !== 'online' && pm !== 'cod') {
      throw new ValidationError('paymentMethod must be online or cod');
    }

    const data = await subscriptionService.createTrialPack({
      userId: req.user.id,
      items,
      addressId,
      deliveryTime,
      paymentMethod: pm,
    });

    if (data.trialCheckoutOrderId) {
      const orderId = data.trialCheckoutOrderId;
      const orderNumber = orderId.split('-')[0].toUpperCase();
      await notifyAdminsForOrder(
        {
          id: orderId,
          orderNumber,
          total: data.orderTotal ?? 0,
          paymentStatus: 'cod',
        },
        {
          containsSubscription: true,
          eventKey: `order:${orderId}:cod`,
        }
      );
    }

    res.status(201).json({
      success: true,
      data,
      message: 'Trial pack created. Please complete payment.',
    });
  } catch (error) {
    next(error);
  }
};

const verifyTrialPackPayment = async (req, res, next) => {
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

    const expectedPaise = await subscriptionService.getTrialPackExpectedOrderAmountPaise(razorpayOrderId, userId);
    if (expectedPaise == null) {
      return res.status(404).json({ success: false, error: 'No pending trial pack for this order' });
    }
    const paidPaise = Number(payment.amount);
    if (paidPaise !== expectedPaise) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount does not match the trial checkout total',
      });
    }

    const subscriptions = await subscriptionService.activateTrialPackByOrderId(razorpayOrderId, userId);
    for (const sub of subscriptions) {
      await notifyAdminsForSubscription(sub, `subscription:${sub.id}:active`, { isTrial: true });
    }
    res.json({ success: true, data: subscriptions, message: 'Trial pack payment verified' });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause subscription
 * POST /api/subscriptions/:id/pause
 */
const pauseSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.pauseSubscription(id, req.user.id);

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
 * Resume subscription
 * POST /api/subscriptions/:id/resume
 */
const resumeSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.resumeSubscription(id, req.user.id);

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription resumed',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel subscription
 * POST /api/subscriptions/:id/cancel
 */
const cancelSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.cancelSubscription(id, req.user.id);

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription cancelled',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel today's delivery (skip delivery for today, extend end date by +1 day)
 * POST /api/subscriptions/:id/cancel-today
 */
const cancelTodaysDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.cancelTodaysDelivery(id, req.user.id);

    res.json({
      success: true,
      data: subscription,
      message: "Today's delivery cancelled",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Setup Razorpay AutoPay mandate for a subscription.
 * POST /api/subscriptions/:id/setup-autopay
 */
const setupAutoPay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await subscriptionService.setupAutoPay(id, req.user.id);
    res.json({
      success: true,
      data: {
        ...data,
        key: process.env.RAZORPAY_KEY_ID,
      },
      message: data.alreadyLinked ? 'AutoPay already linked' : 'AutoPay setup created',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/subscriptions/:id/remove-autopay
 */
const removeAutoPay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await subscriptionService.removeAutoPay(id, req.user.id);
    res.json({ success: true, data, message: 'AutoPay removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/subscriptions/:id/verify-autopay-setup
 */
const verifyAutopaySetup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body || {};
    const data = await subscriptionService.verifyAutopaySetup(id, req.user.id, {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
    });
    res.json({ success: true, data, message: 'AutoPay verification recorded' });
  } catch (error) {
    next(error);
  }
};

const renewExpiredInit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await subscriptionService.renewExpiredSubscriptionInit(id, req.user.id);
    res.json({ success: true, data, message: 'Renewal payment initiated' });
  } catch (error) {
    next(error);
  }
};

const renewExpiredVerify = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId } = req.body || {};
    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new ValidationError('razorpay_order_id and razorpay_payment_id are required');
    }
    const data = await subscriptionService.renewExpiredSubscriptionVerify(
      id,
      req.user.id,
      razorpayOrderId,
      razorpayPaymentId
    );
    res.json({ success: true, data, message: 'Subscription renewed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Razorpay payment and activate subscription
 * POST /api/subscriptions/verify-payment
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

    const match = await subscriptionModel.getSubscriptionByRazorpayId(razorpayOrderId);
    if (!match) return res.status(404).json({ success: false, error: 'Subscription not found' });

    const updated = await subscriptionService.activateSubscription(match.id);
    await notifyAdminsForSubscription(updated, `subscription:${updated.id}:active`);

    res.json({ success: true, data: updated, message: 'Payment verified' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMySubscriptions,
  getSubscriptionById,
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  cancelTodaysDelivery,
  setupAutoPay,
  verifyAutopaySetup,
  removeAutoPay,
  renewExpiredInit,
  renewExpiredVerify,
  verifyPayment,
  createTrialPack,
  estimateTrialPack,
  verifyTrialPackPayment,
};
