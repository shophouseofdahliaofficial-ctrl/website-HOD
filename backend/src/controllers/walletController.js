const { ValidationError } = require('../utils/errors');
const walletService = require('../services/walletService');
const { createOrder: createRazorpayOrder, hasRazorpayKeys, getPayment: getRazorpayPayment } = require('../config/razorpay');

function normalizeAmount(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return rounded > 0 ? rounded : null;
}

const getWallet = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not found');
    const data = await walletService.getWalletSummary(userId, 25);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

const createTopupOrder = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not found');
    const amount = normalizeAmount(req.body?.amount);
    if (!amount) throw new ValidationError('Invalid amount');

    // Dev/local fallback: allow wallet top-up without Razorpay integration.
    // This ensures wallet can be used for testing orders/subscriptions even when payment keys are missing.
    const canManualTopup = process.env.NODE_ENV !== 'production';

    if (!hasRazorpayKeys) {
      if (!canManualTopup) {
        throw new ValidationError('Online payment is not available. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
      }

      const result = await walletService.creditWallet({
        userId,
        amount,
        source: 'razorpay',
        referenceId: `manual_wallet_topup_${Date.now()}`,
      });

      return res.status(201).json({
        success: true,
        data: {
          manual: true,
          credited: result.credited,
          balance: result.balance,
          currency: 'INR',
          amount,
        },
        message: 'Wallet topped up (manual mode)',
      });
    }

    try {
      const razorpayOrder = await createRazorpayOrder({
        amount: Math.round(amount * 100),
        currency: 'INR',
        // Razorpay receipt max length is 40 chars.
        receipt: `wlt_${Date.now()}_${String(userId).replace(/-/g, '').slice(0, 8)}`,
        notes: { wallet_topup: '1', user_id: userId },
      });

      res.status(201).json({
        success: true,
        data: {
          razorpayOrderId: razorpayOrder.id,
          key: process.env.RAZORPAY_KEY_ID,
          currency: razorpayOrder.currency || 'INR',
          amount: razorpayOrder.amount,
        },
        message: 'Open Razorpay to complete wallet top-up',
      });
    } catch (e) {
      if (!canManualTopup) throw e;

      const result = await walletService.creditWallet({
        userId,
        amount,
        source: 'razorpay',
        referenceId: `manual_wallet_topup_${Date.now()}`,
      });

      res.status(201).json({
        success: true,
        data: {
          manual: true,
          credited: result.credited,
          balance: result.balance,
          currency: 'INR',
          amount,
        },
        message: 'Wallet topped up (manual mode)',
      });
    }
  } catch (e) {
    next(e);
  }
};

const verifyTopup = async (req, res, next) => {
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

    if (payment.notes?.user_id && payment.notes.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not your payment' });
    }

    const amount = Math.round((Number(payment.amount) / 100) * 100) / 100;
    const result = await walletService.creditWallet({
      userId,
      amount,
      source: 'razorpay',
      referenceId: razorpayPaymentId,
    });

    res.json({
      success: true,
      data: { balance: result.balance, credited: result.credited },
      message: result.credited ? 'Wallet topped up' : 'Wallet already updated',
    });
  } catch (e) {
    next(e);
  }
};

module.exports = {
  getWallet,
  createTopupOrder,
  verifyTopup,
};

