const { query } = require('../config/database');
const subscriptionModel = require('../models/subscription');

/** Run at least once per hour; cheap UPDATE with indexed columns. */
const INTERVAL_MS = 60 * 60 * 1000;

/**
 * Expire subscriptions whose period has ended and no Razorpay AutoPay mandate is linked.
 * AutoPay rows (razorpay_subscription_id like 'sub_%') are skipped — renewal/charge handles those.
 * Uses exact wall-clock timestamp for trial rows and Asia/Kolkata calendar date for non-trial rows.
 */
async function expireSubscriptionsWithoutAutopay() {
  await subscriptionModel.ensureSubscriptionSchema();
  const result = await query(
    `
    UPDATE subscriptions
    SET status = 'expired', updated_at = NOW()
    WHERE (
      (
        is_trial = TRUE
        AND status IN ('active', 'paused', 'pending')
        AND (
          (
            trial_expires_at IS NOT NULL
            AND trial_expires_at <= NOW()
          )
          OR (
            trial_expires_at IS NULL
            AND end_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
          )
        )
      )
      OR (
        COALESCE(is_trial, FALSE) = FALSE
        AND status IN ('active', 'paused')
        AND end_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
        AND (
          razorpay_subscription_id IS NULL
          OR razorpay_subscription_id NOT LIKE 'sub_%'
        )
      )
    )
    `
  );

  const n = result.rowCount || 0;
  if (n > 0) {
    console.log(
      `[subscription-expiry] Marked ${n} subscription(s) expired (past end_date, no AutoPay mandate).`
    );
  }
}

/**
 * Delete stale pending (unpaid) subscriptions older than 2 hours.
 * These are created when a customer opens Razorpay but closes it without paying.
 * Since getSubscriptionsByUserId already filters them out from the customer view,
 * this is just housekeeping to keep the DB clean.
 */
async function cleanStaleUnpaidSubscriptions() {
  try {
    const deleted = await subscriptionModel.deleteStaleUnpaidSubscriptions(120);
    if (deleted > 0) {
      console.log(`[subscription-cleanup] Deleted ${deleted} stale unpaid (pending) subscription(s).`);
    }
  } catch (e) {
    console.error('[subscription-cleanup] Failed to clean stale pending subscriptions:', e);
  }
}

function startSubscriptionExpiryJob() {
  expireSubscriptionsWithoutAutopay().catch((e) =>
    console.error('[subscription-expiry] initial run failed:', e)
  );
  cleanStaleUnpaidSubscriptions();
  setInterval(() => {
    expireSubscriptionsWithoutAutopay().catch((e) =>
      console.error('[subscription-expiry] run failed:', e)
    );
    cleanStaleUnpaidSubscriptions();
  }, INTERVAL_MS);
}

module.exports = {
  startSubscriptionExpiryJob,
  expireSubscriptionsWithoutAutopay,
  cleanStaleUnpaidSubscriptions,
};
