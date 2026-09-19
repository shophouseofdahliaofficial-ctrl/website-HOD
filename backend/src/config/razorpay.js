const Razorpay = require('razorpay');
require('dotenv').config();

/**
 * Razorpay Configuration
 * Payment gateway for subscription payments (India)
 */
const hasRazorpayKeys = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

// In local/dev environments we should be able to boot the API without payment credentials
// (so auth/admin/product flows can be tested). Payment endpoints will throw a clear error if used.
const razorpay = hasRazorpayKeys
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

if (!hasRazorpayKeys && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.warn(
    '[milko-backend] Razorpay disabled (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET). Subscription payment APIs will not work.'
  );
}

const requireRazorpay = () => {
  if (!razorpay) {
    const err = new Error(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to use payment features.'
    );
    err.code = 'RAZORPAY_NOT_CONFIGURED';
    throw err;
  }
  return razorpay;
};

/** Razorpay Node SDK errors usually expose { error: { description, code } } */
const getRazorpayErrorMessage = (error, fallback) => {
  const d = error?.error?.description || error?.error?.field;
  if (d && String(d).trim()) return String(d).trim();
  if (error?.message && typeof error.message === 'string' && !/^Request failed with status code/i.test(error.message)) {
    return error.message;
  }
  return fallback;
};

/**
 * Create a Razorpay subscription
 * @param {Object} options - Subscription options
 * @param {number} options.amount - Amount in paise (e.g., 10000 = ₹100)
 * @param {string} options.planId - Razorpay plan ID (or create plan on the fly)
 * @param {number} options.customerId - Razorpay customer ID
 * @returns {Promise<Object>} Razorpay subscription object
 */
const createSubscription = async (options) => {
  try {
    const client = requireRazorpay();
    const subscription = await client.subscriptions.create({
      plan_id: options.planId,
      customer_notify: 1,
      total_count: options.totalCount || 1, // Number of billing cycles
      start_at: options.startAt || Math.floor(Date.now() / 1000) + 60, // Start in 60 seconds
    });
    return subscription;
  } catch (error) {
    console.error('Razorpay subscription creation error:', error);
    throw new Error(getRazorpayErrorMessage(error, 'Failed to create subscription'));
  }
};

/**
 * Create a Razorpay order (for one-time payments)
 * @param {Object} options - Order options
 * @param {number} options.amount - Amount in paise
 * @param {string} options.currency - Currency (default: INR)
 * @param {string} options.receipt - Receipt ID
 * @returns {Promise<Object>} Razorpay order object
 */
const createOrder = async (options) => {
  try {
    const client = requireRazorpay();
    const order = await client.orders.create({
      amount: options.amount, // Amount in paise
      currency: options.currency || 'INR',
      receipt: options.receipt,
      notes: options.notes || {},
    });
    return order;
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw new Error(getRazorpayErrorMessage(error, 'Failed to create order'));
  }
};

/**
 * Create a Razorpay plan for recurring AutoPay.
 * @param {Object} options
 * @param {number} options.amount - Amount in paise
 * @param {string} options.period - daily|weekly|monthly|yearly
 * @param {number} options.interval - Billing interval
 * @param {string} options.name - Plan name
 * @param {string} options.description - Plan description
 * @returns {Promise<Object>} Razorpay plan object
 */
const createPlan = async (options) => {
  try {
    const client = requireRazorpay();
    const plan = await client.plans.create({
      period: options.period || 'monthly',
      interval: options.interval || 1,
      item: {
        name: options.name || 'Milko Subscription',
        description: options.description || 'Recurring subscription payment',
        amount: options.amount,
        currency: options.currency || 'INR',
      },
      notes: options.notes || {},
    });
    return plan;
  } catch (error) {
    console.error('Razorpay plan creation error:', error);
    throw new Error(getRazorpayErrorMessage(error, 'Failed to create plan'));
  }
};

/**
 * Create a Razorpay recurring subscription from a plan.
 * @param {Object} options
 * @param {string} options.planId
 * @param {number} options.totalCount
 * @param {number} options.startAt
 * @returns {Promise<Object>} Razorpay subscription object
 */
const createAutoPaySubscription = async (options) => {
  try {
    const client = requireRazorpay();
    const subscription = await client.subscriptions.create({
      plan_id: options.planId,
      customer_notify: 1,
      total_count: options.totalCount || 120,
      start_at: options.startAt || Math.floor(Date.now() / 1000) + 60,
      notes: options.notes || {},
    });
    return subscription;
  } catch (error) {
    console.error('Razorpay autopay subscription creation error:', error);
    throw new Error(getRazorpayErrorMessage(error, 'Failed to setup autopay'));
  }
};

/**
 * Cancel a Razorpay recurring subscription (mandate / AutoPay).
 * @param {string} razorpaySubscriptionId - e.g. sub_xxxxx
 */
const cancelRazorpaySubscription = async (razorpaySubscriptionId) => {
  try {
    const client = requireRazorpay();
    await client.subscriptions.cancel(razorpaySubscriptionId);
  } catch (error) {
    console.error('Razorpay subscription cancel error:', error);
    throw new Error(getRazorpayErrorMessage(error, 'Failed to cancel AutoPay with Razorpay'));
  }
};

/**
 * Verify webhook signature
 * @param {string} signature - Webhook signature
 * @param {string} orderId - Order ID
 * @param {string} paymentId - Payment ID
 * @returns {boolean} True if signature is valid
 */
const verifyWebhookSignature = (signature, orderId, paymentId) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('Razorpay webhook secret not configured (RAZORPAY_WEBHOOK_SECRET)');
  }
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expectedSignature === signature;
};

/**
 * Get payment details
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details
 */
const getPayment = async (paymentId) => {
  try {
    const client = requireRazorpay();
    const payment = await client.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Razorpay get payment error:', error);
    throw new Error(getRazorpayErrorMessage(error, 'Failed to fetch payment'));
  }
};

module.exports = {
  razorpay,
  hasRazorpayKeys,
  createSubscription,
  createPlan,
  createAutoPaySubscription,
  cancelRazorpaySubscription,
  createOrder,
  verifyWebhookSignature,
  getPayment,
};

