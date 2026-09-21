const crypto = require('crypto');
const subscriptionModel = require('../models/subscription');
const productModel = require('../models/product');
const orderModel = require('../models/order');
const addressModel = require('../models/address');
const {
  createOrder,
  createPlan,
  createAutoPaySubscription,
  cancelRazorpaySubscription,
  getPayment,
  hasRazorpayKeys,
} = require('../config/razorpay');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { getClient, query } = require('../config/database');
const walletService = require('./walletService');
const { computeFirstDayShiftBonus } = require('./subscriptionSlotShift');
const { getPlatformFeeAmount, roundMoney, calculateCheckoutFees } = require('./pricingService');
const {
  isDeliverableForProduct,
  getProductDeliveryPincodes,
  normalizePostalCode,
  assertProductsDeliverableToPostalCode,
  assertSubscriptionPostalCodeServiceable,
} = require('./productDeliverabilityService');

const AUTOPAY_FAILURE_MESSAGE = 'Autopay failed: Either low balance or Issue with the provider.';

function formatSubscriptionEndDateYmd(row) {
  const v = row.end_date;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v).slice(0, 10);
}

/** First charge at 00:00 IST on the calendar day after `end_date` (subscription last day). */
function getAutopayFirstChargeUnixSeconds(endDateYmd) {
  const endDateStartsIst = new Date(`${endDateYmd}T00:00:00+05:30`);
  const nextMidnightIst = new Date(endDateStartsIst.getTime() + 24 * 60 * 60 * 1000);
  return Math.floor(nextMidnightIst.getTime() / 1000);
}

function getDeliveryCount(freq, durationDays) {
  if (freq === 'alternate') return Math.floor((durationDays - 1) / 2) + 1;
  if (freq === 'weekly') return Math.floor((durationDays - 1) / 7) + 1;
  if (freq === 'monthly') return Math.floor((durationDays - 1) / 30) + 1;
  return durationDays;
}

const SUBSCRIPTION_CALENDAR_TZ = process.env.SUBSCRIPTION_CALENDAR_TZ || 'Asia/Kolkata';

function ymdFromLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Calendar YYYY-MM-DD in SUBSCRIPTION_CALENDAR_TZ for a given instant (e.g. order placed).
 * Used so subscription start matches the customerâ€™s purchase day even if activation runs later
 * (Razorpay verify / webhook the next calendar day).
 */
function ymdFromInstantInSubscriptionCalendar(dateLike) {
  if (dateLike == null || dateLike === '') return null;
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: SUBSCRIPTION_CALENDAR_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch (e) {
    /* ignore */
  }
  return null;
}

/** Subscription â€œtodayâ€ = calendar date in business TZ (default IST), not server UTC. */
function ymdTodaySubscriptionCalendar() {
  return ymdFromInstantInSubscriptionCalendar(new Date()) || ymdFromLocalDate(new Date());
}

/** IANA zone name safe to pass to PostgreSQL `AT TIME ZONE`. */
function subscriptionCalendarPgZone() {
  const z = String(SUBSCRIPTION_CALENDAR_TZ || 'Asia/Kolkata').trim();
  if (!/^[\w/.+-]+$/.test(z) || z.length > 63) return 'Asia/Kolkata';
  return z;
}

/**
 * Todayâ€™s calendar date in SUBSCRIPTION_CALENDAR_TZ from PostgreSQL.
 * Nodeâ€™s host timezone / `Date` parsing (and TIMESTAMP WITHOUT TIME ZONE on orders) often skews
 * â€œtodayâ€ by one day vs what customers in India see â€” the DB conversion is the source of truth.
 * @param {object | null} client - optional pg transaction client (same as `query()` if omitted)
 */
async function ymdTodayFromDatabase(client) {
  const zone = subscriptionCalendarPgZone();
  const sql = `SELECT (CURRENT_TIMESTAMP AT TIME ZONE $1)::date::text AS ymd`;
  try {
    const r = client ? await client.query(sql, [zone]) : await query(sql, [zone]);
    const ymd = r.rows[0]?.ymd;
    if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  } catch (e) {
    /* ignore */
  }
  return ymdTodaySubscriptionCalendar();
}

function ymdLexMax(a, b) {
  const ok = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  if (!ok(a)) return ok(b) ? b : ymdTodaySubscriptionCalendar();
  if (!ok(b)) return a;
  return a >= b ? a : b;
}

/**
 * First delivery / period anchor: max(DB â€œtodayâ€, Node IST â€œtodayâ€).
 * Supabase/pooler clocks sometimes report one calendar day behind the real India purchase date;
 * Intl in Node matches what the customer sees for â€œPurchasedâ€, so we never start the plan earlier.
 */
async function subscriptionStartYmdAnchor(client) {
  const fromDb = await ymdTodayFromDatabase(client);
  const fromNode = ymdFromInstantInSubscriptionCalendar(new Date());
  return ymdLexMax(fromDb, fromNode || '');
}

/**
 * Trial pack base = 1 delivery day; apply the same first-day slot-shift as full subscriptions at purchase.
 * When shift applies, plan spans two calendar days with the first day skipped in delivery schedules.
 */
async function computeTrialPackCalendarAtPurchase({ deliveryTime, client = null }) {
  const startYmd = await subscriptionStartYmdAnchor(client);
  const { bonusDays, reason } = await computeFirstDayShiftBonus({
    deliveryTime,
    activationInstant: new Date(),
  });
  const safeBonus = Math.max(0, Number(bonusDays) || 0);
  const durationDays = Math.max(1, 1 + safeBonus);
  const endYmd = lastInclusiveDeliveryYmd(startYmd, durationDays);
  const firstDayShiftApplied = safeBonus > 0;
  return {
    startYmd,
    endYmd,
    durationDays,
    firstDayShiftApplied,
    firstDayShiftReason: firstDayShiftApplied ? reason || null : null,
  };
}

/** Add whole calendar days to YYYY-MM-DD (UTC Gregorian; stable, no local/UTC parse mix). */
function addCalendarDaysYmd(ymd, delta) {
  const parts = String(ymd).slice(0, 10).split('-');
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10) - 1;
  const da = parseInt(parts[2], 10);
  const ms = Date.UTC(y, mo, da) + delta * 86400000;
  const u = new Date(ms);
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`;
}

function addLocalDaysYmd(ymd, delta) {
  return addCalendarDaysYmd(ymd, delta);
}

/**
 * Last delivery calendar day for exactly `deliveryDayCount` delivery days when `startYmd` is day 1
 * (purchase day counts). `duration_days` and billing use `deliveryDayCount` unchanged â€” the `-1`
 * in the math is only â€œfrom day 1 to day N you advance Nâˆ’1 steps on the calendar,â€ not a shorter plan.
 */
function lastInclusiveDeliveryYmd(startYmd, deliveryDayCount) {
  const n = Math.max(1, Math.floor(Number(deliveryDayCount) || 1));
  return addCalendarDaysYmd(startYmd, n - 1);
}

/** Prefer explicit calendar days from the client; else legacy month buckets (30 days each). */
function resolvePlanDaysFromPayload({ durationDays, durationMonths }) {
  const dd = Number(durationDays);
  if (Number.isFinite(dd) && dd >= 1) return Math.min(3650, Math.floor(dd));
  const mm = Number(durationMonths);
  if (Number.isFinite(mm) && mm >= 1) return Math.max(1, Math.round(mm * 30));
  return null;
}

/** DB row: use duration_days when set; else duration_months * 30 (legacy). */
function planDaysFromSubscriptionRow(row) {
  if (row.duration_days != null && row.duration_days !== undefined) {
    const d = parseInt(row.duration_days, 10);
    if (Number.isFinite(d) && d >= 1) return d;
  }
  const m = Math.max(1, parseInt(row.duration_months || 1, 10));
  return Math.max(1, Math.round(m * 30));
}

/**
 * Get the current per-unit price for a subscription based on current product/variation price.
 * Falls back to saved price if product/variation not found or error occurs.
 */
const getCurrentSubscriptionPerUnitPrice = async (s) => {
  try {
    const product = await productModel.getProductById(s.product_id);
    if (!product) return parseFloat(s.per_unit_price || 0);

    const basePrice =
      product.sellingPrice !== null && product.sellingPrice !== undefined
        ? Number(product.sellingPrice)
        : Number(product.pricePerLitre);

    if (s.product_variation_id) {
      const varRes = await query(
        `SELECT price, price_multiplier FROM product_variations WHERE id = $1`,
        [s.product_variation_id]
      );
      if (varRes.rows.length > 0) {
        const v = varRes.rows[0];
        const multiplier = Number(v.price_multiplier) || 1;
        // Match createSubscription logic: use variation price / multiplier if variation price exists.
        return v.price !== null && v.price !== undefined ? Number(v.price) / multiplier : basePrice;
      }
    }
    return basePrice;
  } catch (e) {
    console.error('[getCurrentSubscriptionPerUnitPrice] error:', e);
    return parseFloat(s.per_unit_price || 0);
  }
};

/**
 * Get the original plan days (ignoring extensions from cancellations/shifts) for renewal.
 * Prioritizes duration_days from the record (accounting for shifts), falling back to duration_months.
 */
const getSubscriptionRenewalDays = (s) => {
  if (s.duration_days != null && s.duration_days > 0) {
    const days = parseInt(s.duration_days, 10);
    // If shift was applied in the previous cycle, duration_days includes the frequency-interval bonus.
    // Subtract the full interval step to get back to the original plan duration (7, 15, 30, etc.)
    if (s.first_day_shift_applied) {
      let intervalStep = 1;
      const freq = (s.frequency || 'daily').toLowerCase();
      if (freq === 'alternate') intervalStep = 2;
      else if (freq === 'weekly') intervalStep = 7;
      else if (freq === 'monthly') intervalStep = 30;
      return Math.max(1, days - intervalStep);
    }
    return days;
  }
  const m = Math.max(1, parseInt(s.duration_months || 1, 10));
  return m * 30;
};

function resolveTrialLitresPerDay(selectedVariation) {
  if (!selectedVariation) return 1;
  const multiplier = Number(selectedVariation.price_multiplier);
  if (Number.isFinite(multiplier) && multiplier > 0) return multiplier;
  return 1;
}

/**
 * Subscription Service
 * Handles subscription business logic
 */

/**
 * Create a new subscription
 * Creates subscription record and Razorpay order for payment
 * @param {Object} subscriptionData - Subscription data
 * @returns {Promise<Object>} Subscription and Razorpay order
 */
const createSubscription = async (subscriptionData) => {
  const {
    userId,
    productId,
    variationId = null,
    litresPerDay,
    durationMonths,
    durationDays,
    deliveryTime,
    paymentMethod = 'wallet',
    addressId = null,
    trialSubscriptionId = null,
    frequency = 'daily',
  } = subscriptionData;

  // Validate product exists and is active
  const product = await productModel.getProductById(productId);
  if (!product) {
    throw new NotFoundError('Product');
  }

  if (product.isActive === false) {
    throw new ValidationError('Product is not available');
  }

  await subscriptionModel.ensureSubscriptionSchema();
  await walletService.ensureWalletSchema();

  const daysInDuration = resolvePlanDaysFromPayload({ durationDays, durationMonths });
  if (!daysInDuration) {
    throw new ValidationError('Invalid subscription duration');
  }
  const durationMonthsForDb = Math.max(1, Math.round(daysInDuration / 30));

  let selectedVariation = null;
  if (variationId) {
    const variationRes = await query(
      `
      SELECT id, size, price_multiplier, price
      FROM product_variations
      WHERE id = $1 AND product_id = $2
      `,
      [variationId, productId]
    );
    if (variationRes.rows.length === 0) {
      throw new ValidationError('Invalid subscription variation');
    }
    selectedVariation = variationRes.rows[0];
  }

  const basePerUnitPrice =
    product.sellingPrice !== null && product.sellingPrice !== undefined
      ? Number(product.sellingPrice)
      : Number(product.pricePerLitre);
  const variationMultiplier =
    selectedVariation?.price_multiplier !== null && selectedVariation?.price_multiplier !== undefined
      ? Number(selectedVariation.price_multiplier)
      : 1;
  const perUnitPrice =
    selectedVariation?.price !== null && selectedVariation?.price !== undefined
      ? Number(selectedVariation.price) / variationMultiplier
      : basePerUnitPrice;
  const totalQty = (litresPerDay * variationMultiplier) * Math.max(1, getDeliveryCount(frequency, daysInDuration));
  const totalAmount = roundMoney(perUnitPrice * totalQty);
  const platformFee = await getPlatformFeeAmount();
  const basePayableAmount = roundMoney(totalAmount + platformFee);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (addressId) {
      const addrRes = await client.query(`SELECT id, postal_code FROM addresses WHERE id::text = $1::text AND user_id::text = $2::text`, [String(addressId), String(userId)]);
      if (addrRes.rows.length === 0) {
        throw new ValidationError('Invalid delivery address');
      }
      const postalCode = normalizePostalCode(addrRes.rows[0].postal_code);
      const deliveryPincodes = await getProductDeliveryPincodes(productId);
      if (!isDeliverableForProduct(deliveryPincodes || [], postalCode)) {
        throw new ValidationError(`Selected product is not deliverable to pincode ${postalCode || '-'}`);
      }
      await assertSubscriptionPostalCodeServiceable(postalCode);
    }

    let discountAmount = 0;
    let trialRow = null;
    if (trialSubscriptionId) {
      const trialRes = await client.query(
        `SELECT *
         FROM subscriptions
         WHERE id = $1
           AND user_id = $2
           AND is_trial = TRUE
           AND (trial_credit_used IS DISTINCT FROM TRUE)
           AND status IN ('active', 'expired', 'pending')
         FOR UPDATE`,
        [trialSubscriptionId, userId]
      );
      if (trialRes.rows.length === 0) {
        throw new ValidationError('Trial subscription not found');
      }
      trialRow = trialRes.rows[0];
      if (String(trialRow.product_id) !== String(productId)) {
        throw new ValidationError('Trial credit can only be used for the same product');
      }
      if (variationId && trialRow.product_variation_id != null && String(trialRow.product_variation_id) !== String(variationId)) {
        throw new ValidationError('Trial credit can only be used for the same product variation');
      }
      // if (trialRow.trial_credit_used === true) {
      //   throw new ValidationError('This trial credit was already used');
      // }
      const availableTrialCredit = roundMoney(
        parseFloat(trialRow.trial_credit_amount || trialRow.total_amount_paid || trialRow.total_amount || 0),
      );
      discountAmount = Math.max(0, Math.min(availableTrialCredit, basePayableAmount));
    }

    let walletUsed = 0;
    let remainingAmount = Math.max(0, Math.round((basePayableAmount - discountAmount) * 100) / 100);

    if (paymentMethod === 'wallet') {
      const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1`, [userId]);
      const walletBalance = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].wallet_balance || 0) : 0;
      walletUsed = Math.max(0, Math.min(walletBalance, remainingAmount));
      remainingAmount = Math.max(0, Math.round((remainingAmount - walletUsed) * 100) / 100);
    }

    let razorpayOrder = null;
    if (remainingAmount > 0) {
      if (!hasRazorpayKeys) {
        throw new ValidationError('Online payment is not available. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
      }

      razorpayOrder = await createOrder({
        amount: Math.round(remainingAmount * 100),
        currency: 'INR',
        // Razorpay receipt max length is 40 chars.
        receipt: `sub_${Date.now()}_${String(userId).replace(/-/g, '').slice(0, 8)}`,
        notes: {
          userId,
          productId,
          litresPerDay,
          durationMonths: durationMonthsForDb,
          durationDays: daysInDuration,
          deliveryTime,
          flow: trialSubscriptionId ? 'trial_upgrade' : 'subscription',
          trialSubscriptionId: trialSubscriptionId ? String(trialSubscriptionId) : undefined,
        },
      });
    }

    let subRes;
    if (trialSubscriptionId && trialRow) {
      // Razorpay upgrade: UPDATE the same trial row to full-plan pending (same subscription id).
      // Keep is_trial=TRUE and trial_credit_used=FALSE until activateSubscription runs after payment,
      // so retries after closing Razorpay still match the trial lookup above.
      if (remainingAmount > 0 && razorpayOrder) {
        await client.query(
          `DELETE FROM subscriptions
           WHERE user_id = $1
             AND status = 'pending'
             AND upgrade_from_trial_subscription_id = $2`,
          [userId, trialSubscriptionId]
        );
        subRes = await client.query(
          `
        UPDATE subscriptions
        SET product_id = $1,
            litres_per_day = $2,
            duration_months = $3,
            duration_days = $4,
            delivery_time = $5,
            address_id = $6,
            product_variation_id = $7,
            start_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
            end_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + ($4::integer - 1),
            razorpay_subscription_id = $8,
            status = 'pending',
            total_qty = $9,
            delivered_qty = 0,
            remaining_qty = $9,
            per_unit_price = $10,
            total_amount = $11,
            total_amount_paid = $12,
            wallet_used = $13,
            platform_fee = $14,
            purchased_at = $15,
            discount_amount = $16,
            is_trial = TRUE,
            trial_expires_at = NULL,
            trial_credit_amount = 0,
            trial_credit_used = FALSE,
            trial_shifted = TRUE,
            upgrade_from_trial_subscription_id = NULL,
            frequency = $19,
            updated_at = NOW()
        WHERE id = $17 AND user_id = $18
        RETURNING id
        `,
          [
            productId,
            litresPerDay,
            durationMonthsForDb,
            daysInDuration,
            deliveryTime,
            addressId,
            variationId,
            razorpayOrder.id,
            totalQty,
            perUnitPrice,
            totalAmount,
            roundMoney(walletUsed + discountAmount),
            walletUsed,
            platformFee,
            new Date().toISOString(),
            discountAmount,
            trialSubscriptionId,
            userId,
            frequency,
          ]
        );
        if (subRes.rows.length === 0) {
          throw new ValidationError('Trial subscription not found');
        }
      } else {
        subRes = await client.query(
          `
        UPDATE subscriptions
        SET product_id = $1,
            litres_per_day = $2,
            duration_months = $3,
            duration_days = $4,
            delivery_time = $5,
            address_id = $6,
            product_variation_id = $7,
            start_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
            end_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + ($4::integer - 1),
            razorpay_subscription_id = $8,
            status = 'pending',
            total_qty = $9,
            delivered_qty = 0,
            remaining_qty = $9,
            per_unit_price = $10,
            total_amount = $11,
            total_amount_paid = $12,
            wallet_used = $13,
            platform_fee = $14,
            purchased_at = $15,
            discount_amount = $16,
            is_trial = FALSE,
            trial_expires_at = NULL,
            trial_credit_amount = 0,
            trial_credit_used = TRUE,
            trial_shifted = TRUE,
            frequency = $19,
            updated_at = NOW()
        WHERE id = $17 AND user_id = $18
        RETURNING id
        `,
          [
            productId,
            litresPerDay,
            durationMonthsForDb,
            daysInDuration,
            deliveryTime,
            addressId,
            variationId,
            razorpayOrder ? razorpayOrder.id : trialRow.razorpay_subscription_id,
            totalQty,
            perUnitPrice,
            totalAmount,
            roundMoney(walletUsed + discountAmount),
            walletUsed,
            platformFee,
            new Date().toISOString(),
            discountAmount,
            trialSubscriptionId,
            userId,
            frequency,
          ]
        );
      }
    } else {
      subRes = await client.query(
        `
        INSERT INTO subscriptions (
          user_id, product_id, litres_per_day, duration_months, duration_days, delivery_time,
          address_id, product_variation_id,
          start_date, end_date, razorpay_subscription_id, status,
          total_qty, delivered_qty, remaining_qty, per_unit_price, total_amount, total_amount_paid, wallet_used, platform_fee, purchased_at,
          discount_amount, is_trial, trial_credit_amount, trial_credit_used, frequency,
          created_at, updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + ($5::integer - 1),
          $9,'pending',
          $10,0,$10,$11,$12,$13,$14,$15,$16,
          $17,FALSE,0,FALSE,$18,
          NOW(),NOW()
        )
        RETURNING id
        `,
        [
          userId,
          productId,
          litresPerDay,
          durationMonthsForDb,
          daysInDuration,
          deliveryTime,
          addressId,
          variationId,
          razorpayOrder ? razorpayOrder.id : null,
          totalQty,
          perUnitPrice,
          totalAmount,
          roundMoney(walletUsed + discountAmount),
          walletUsed,
          platformFee,
          new Date().toISOString(),
          discountAmount,
          frequency,
        ]
      );
    }

    const subscriptionId = subRes.rows[0].id;

    await client.query('COMMIT');

    if (remainingAmount <= 0) {
      const subscription = await activateSubscription(subscriptionId);
      return { subscription, razorpayOrder: null };
    }

    const subscription = await subscriptionModel.getSubscriptionById(subscriptionId);
    return {
      subscription,
      razorpayOrder: razorpayOrder
        ? {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            orderId: razorpayOrder.id,
            key: process.env.RAZORPAY_KEY_ID,
          }
        : null,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

/**
 * Activate subscription after payment confirmation
 * Called by webhook handler after successful payment
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Updated subscription
 */
const activateSubscription = async (subscriptionId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  await walletService.ensureWalletSchema();
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const subRes = await client.query(`SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE`, [subscriptionId]);
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];

    if (s.status === 'active') {
      await client.query('COMMIT');
      return await subscriptionModel.getSubscriptionById(subscriptionId);
    }

    const walletUsed = parseFloat(s.wallet_used || 0);
    if (walletUsed > 0) {
      const txRef = `subscription:${subscriptionId}:activation`;
      const txExists = await client.query(
        `SELECT 1 FROM wallet_transactions WHERE user_id = $1 AND type = 'debit' AND source = 'subscription' AND reference_id = $2 LIMIT 1`,
        [s.user_id, txRef]
      );

      if (txExists.rows.length === 0) {
        const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [s.user_id]);
        const walletBalance = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].wallet_balance || 0) : 0;
        if (walletBalance < walletUsed) {
          throw new ValidationError('Wallet balance is insufficient to activate this subscription');
        }

        await client.query(`UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2`, [
          walletUsed,
          s.user_id,
        ]);

        await client.query(
          `
          INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
          VALUES ($1,'debit',$2,'subscription',$3)
          `,
          [s.user_id, walletUsed, txRef]
        );
      }
    }

    const baseDays = Math.max(1, parseInt(s.duration_days, 10) || planDaysFromSubscriptionRow(s));
    const isTrialRow = s.is_trial === true || s.is_trial === 't';
    const trialShiftAlreadyAtPurchase =
      isTrialRow && (s.first_day_shift_applied === true || s.first_day_shift_applied === 't');
    // Slot shift must use when the customer committed to the plan, not when activation runs.
    // - Cart: order.created_at (COD / paid checkout can activate much later than placement).
    // - Subscribe page (wallet or Razorpay): purchased_at at row create; using "now" here breaks
    //   evening-slot / after-window purchases when payment verify runs next calendar morning.
    let activationInstantForShift = new Date();
    if (s.checkout_order_id) {
      const ordRes = await client.query(`SELECT created_at FROM orders WHERE id::text = $1::text LIMIT 1`, [String(s.checkout_order_id)]);
      const ct = ordRes.rows[0]?.created_at;
      if (ct) activationInstantForShift = new Date(ct);
    } else {
      const purchaseInstant = s.purchased_at || s.created_at;
      if (purchaseInstant) activationInstantForShift = new Date(purchaseInstant);
    }
    const shiftAtActivate = await computeFirstDayShiftBonus({
      deliveryTime: s.delivery_time,
      activationInstant: activationInstantForShift,
      frequency: s.frequency || 'daily',
    });
    const bonusDays = trialShiftAlreadyAtPurchase ? 0 : shiftAtActivate.bonusDays;
    const newDays = baseDays + bonusDays;
    let variationMultiplier = 1;
    if (s.product_variation_id) {
      const varRes = await client.query(`SELECT price_multiplier FROM product_variations WHERE id = $1`, [s.product_variation_id]);
      if (varRes.rows.length > 0) {
        variationMultiplier = parseFloat(varRes.rows[0].price_multiplier || 1);
      }
    }
    const deliveryCount = Math.max(1, getDeliveryCount(s.frequency || 'daily', newDays));
    const litres = parseFloat(s.litres_per_day || 0);
    const newTotalQty = litres * variationMultiplier * deliveryCount;
    const firstDayShiftApplied = trialShiftAlreadyAtPurchase || bonusDays > 0;
    const firstDayShiftReason =
      bonusDays > 0
        ? shiftAtActivate.reason || null
        : trialShiftAlreadyAtPurchase
          ? s.first_day_shift_reason || null
          : null;

    await client.query(
      `
      UPDATE subscriptions
      SET status = 'active',
          total_amount_paid = GREATEST(0, COALESCE(total_amount, 0) + COALESCE(platform_fee, 0) - COALESCE(discount_amount, 0)),
          purchased_at = COALESCE(purchased_at, NOW()),
          duration_days = $2,
          end_date = start_date + ($2::integer - 1) * INTERVAL '1 day',
          total_qty = $3,
          remaining_qty = $3,
          first_day_shift_applied = $4,
          first_day_shift_reason = $5,
          is_trial = FALSE,
          trial_expires_at = NULL,
          trial_credit_used = CASE WHEN $6::boolean THEN TRUE ELSE trial_credit_used END,
          updated_at = NOW()
      WHERE id = $1
      `,
      [subscriptionId, newDays, newTotalQty, firstDayShiftApplied, firstDayShiftReason, isTrialRow]
    );

    const upgradeFromTrialId = s.upgrade_from_trial_subscription_id;
    if (upgradeFromTrialId) {
      await client.query(
        `
        UPDATE subscriptions
        SET status = 'cancelled',
            cancelled_at = NOW(),
            trial_credit_used = TRUE,
            updated_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND is_trial = TRUE
        `,
        [upgradeFromTrialId, s.user_id]
      );
    }

    await client.query(`DELETE FROM delivery_schedules WHERE subscription_id = $1`, [subscriptionId]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const subscription = await subscriptionModel.getSubscriptionById(subscriptionId);
  if (!subscription) throw new NotFoundError('Subscription');

  // Generate schedules after successful activation.
  // Slot-shift: first calendar day had no slot (purchase after window) — skip that day in admin; bonus day at end is included.
  const skipShiftYmd =
    subscription.firstDayShiftApplied && subscription.startDate
      ? String(subscription.startDate).trim().slice(0, 10)
      : null;
  await subscriptionModel.generateDeliverySchedules(
    subscriptionId,
    subscription.startDate,
    subscription.endDate,
    skipShiftYmd && /^\d{4}-\d{2}-\d{2}$/.test(skipShiftYmd)
      ? { skipShiftedFirstDayYmd: skipShiftYmd }
      : {},
  );

  return await subscriptionModel.getSubscriptionById(subscriptionId);
};

/**
 * Pause subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string|null} userId - User ID (for authorization check, null for admin)
 * @returns {Promise<Object>} Updated subscription
 */
const pauseSubscription = async (subscriptionId, userId) => {
  const subscription = userId
    ? await subscriptionModel.getSubscriptionByIdForUser(subscriptionId, userId)
    : await subscriptionModel.getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new NotFoundError('Subscription');
  }

  if (subscription.status !== 'active') {
    throw new ValidationError('Only active subscriptions can be paused');
  }

  return await subscriptionModel.updateSubscriptionStatus(subscriptionId, 'paused');
};

/**
 * Resume subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string|null} userId - User ID (for authorization check, null for admin)
 * @returns {Promise<Object>} Updated subscription
 */
const resumeSubscription = async (subscriptionId, userId) => {
  const subscription = userId
    ? await subscriptionModel.getSubscriptionByIdForUser(subscriptionId, userId)
    : await subscriptionModel.getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new NotFoundError('Subscription');
  }

  if (subscription.status !== 'paused') {
    throw new ValidationError('Only paused subscriptions can be resumed');
  }

  return await subscriptionModel.updateSubscriptionStatus(subscriptionId, 'active');
};

/**
 * Cancel subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID (for authorization check)
 * @returns {Promise<Object>} Updated subscription
 */
const cancelSubscription = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  await walletService.ensureWalletSchema();

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const subRes = await client.query(
      `
      SELECT s.*, p.selling_price, p.price_per_litre
      FROM subscriptions s
      LEFT JOIN products p ON p.id = s.product_id
      WHERE s.id = $1
      FOR UPDATE OF s
      `,
      [subscriptionId]
    );
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];

    if (String(s.user_id) !== String(userId)) {
      throw new ValidationError('Unauthorized');
    }

    if (s.status === 'pending') {
      await client.query(`DELETE FROM subscriptions WHERE id = $1`, [subscriptionId]);
      await client.query('COMMIT');
      return { id: subscriptionId, status: 'cancelled' };
    }

    if (s.status === 'cancelled') {
      await client.query('COMMIT');
      return await subscriptionModel.getSubscriptionById(subscriptionId);
    }

    // If AutoPay is linked, cancel it with Razorpay as well
    const rpId = s.razorpay_subscription_id;
    if (rpId && String(rpId).startsWith('sub_')) {
      try {
        await cancelRazorpaySubscription(rpId);
      } catch (e) {
        console.warn('[cancelSubscription] Razorpay mandate cancel failed:', e?.message || e);
        // We continue anyway so the local cancellation completes
      }
    }

    const perUnitPrice =
      s.per_unit_price !== null && s.per_unit_price !== undefined
        ? parseFloat(s.per_unit_price)
        : s.selling_price !== null && s.selling_price !== undefined
          ? parseFloat(s.selling_price)
          : parseFloat(s.price_per_litre);

    let remainingQty = s.remaining_qty !== null && s.remaining_qty !== undefined ? parseFloat(s.remaining_qty) : null;
    if (remainingQty === null) {
      const pending = await client.query(
        `SELECT COUNT(*)::int AS c FROM delivery_schedules WHERE subscription_id = $1 AND status = 'pending' AND delivery_date >= CURRENT_DATE`,
        [subscriptionId]
      );
      const pendingDays = pending.rows[0]?.c || 0;
      remainingQty = pendingDays * parseFloat(s.litres_per_day);
    }

    const refundAmount = Math.max(0, Math.round(remainingQty * perUnitPrice * 100) / 100);

    if (refundAmount > 0) {
      await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);

      const inserted = await client.query(
        `
        INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
        VALUES ($1,'credit',$2,'refund',$3)
        ON CONFLICT DO NOTHING
        RETURNING id
        `,
        [userId, refundAmount, `refund:subscription:${subscriptionId}`]
      );

      if (inserted.rows.length > 0) {
        await client.query(`UPDATE users SET wallet_balance = wallet_balance + $1, updated_at = NOW() WHERE id = $2`, [
          refundAmount,
          userId,
        ]);
      }
    }

    await client.query(
      `
      UPDATE subscriptions
      SET status = 'cancelled',
          cancelled_at = NOW(),
          remaining_qty = 0,
          razorpay_subscription_id = NULL,
          autopay_status = NULL,
          updated_at = NOW()
      WHERE id = $1
      `,
      [subscriptionId]
    );

    await client.query(
      `
      UPDATE delivery_schedules
      SET status = 'cancelled', updated_at = NOW()
      WHERE subscription_id = $1 AND delivery_date >= CURRENT_DATE AND status = 'pending'
      `,
      [subscriptionId]
    );

    await client.query('COMMIT');
    return await subscriptionModel.getSubscriptionById(subscriptionId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const cancelTodaysDelivery = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const subRes = await client.query(
      `SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE`,
      [subscriptionId]
    );
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];
    if (String(s.user_id) !== String(userId)) throw new ValidationError('Unauthorized');
    if (s.status !== 'active') throw new ValidationError('Only active subscriptions can skip delivery');

    // Compute today's date in IST (subscription calendar timezone).
    const todayIST = (() => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      return y && m && d ? `${y}-${m}-${d}` : new Date().toISOString().slice(0, 10);
    })();

    // Determine frequency interval step.
    const frequency = (s.frequency || 'daily').toLowerCase();
    let intervalStep = 1;
    if (frequency === 'alternate') intervalStep = 2;
    else if (frequency === 'weekly') intervalStep = 7;
    else if (frequency === 'monthly') intervalStep = 30;

    // Guard: Block cancel-today when today has no scheduled delivery entry.
    // This covers: (a) the shifted first day for any frequency, (b) gap days between
    // deliveries for alternate/weekly/monthly subscriptions.
    const scheduleCheck = await client.query(
      `SELECT status FROM delivery_schedules WHERE subscription_id = $1 AND delivery_date = $2 LIMIT 1`,
      [subscriptionId, todayIST]
    );
    if (scheduleCheck.rows.length === 0) {
      throw new ValidationError(
        'No delivery is scheduled for today — you can only cancel on a day when a delivery is due.'
      );
    }
    const existingStatus = scheduleCheck.rows[0].status;
    if (existingStatus === 'skipped' || existingStatus === 'cancelled') {
      throw new ValidationError('Today\'s delivery has already been cancelled.');
    }
    if (existingStatus === 'delivered') {
      throw new ValidationError('Today\'s delivery has already been completed.');
    }

    const today = todayIST;

    await client.query(
      `
      INSERT INTO paused_dates (subscription_id, date, reason, created_at)
      VALUES ($1,$2,'cancel_today',NOW())
      ON CONFLICT (subscription_id, date) DO UPDATE SET reason = 'cancel_today'
      `,
      [subscriptionId, today]
    );

    await client.query(
      `
      INSERT INTO delivery_schedules (subscription_id, delivery_date, status, created_at, updated_at)
      VALUES ($1,$2,'skipped',NOW(),NOW())
      ON CONFLICT (subscription_id, delivery_date) DO UPDATE SET status = 'skipped', updated_at = NOW()
      `,
      [subscriptionId, today]
    );

    // Extend end_date by a full frequency interval (not just 1 day) so the cycle is preserved.
    // For daily: +1 day; alternate: +2 days; weekly: +7 days; monthly: +30 days.
    const upd = await client.query(
      `
      UPDATE subscriptions
      SET end_date = end_date + ($2::integer * INTERVAL '1 day'),
          duration_days = COALESCE(duration_days, 0) + $2::integer,
          updated_at = NOW()
      WHERE id = $1
      RETURNING end_date
      `,
      [subscriptionId, intervalStep]
    );

    // Insert the makeup delivery at the correct new end date (already on a frequency boundary).
    const newEnd = upd.rows[0].end_date instanceof Date
      ? ymdFromLocalDate(upd.rows[0].end_date)
      : String(upd.rows[0].end_date).slice(0, 10);

    const paused = await client.query(`SELECT 1 FROM paused_dates WHERE subscription_id = $1 AND date = $2`, [
      subscriptionId,
      newEnd,
    ]);
    if (paused.rows.length === 0) {
      await client.query(
        `
        INSERT INTO delivery_schedules (subscription_id, delivery_date, status, created_at, updated_at)
        VALUES ($1,$2,'pending',NOW(),NOW())
        ON CONFLICT (subscription_id, delivery_date) DO NOTHING
        `,
        [subscriptionId, newEnd]
      );
    }

    await client.query('COMMIT');
    return await subscriptionModel.getSubscriptionById(subscriptionId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

async function loadTrialPackDeliveryAddressJson(userId, addressId) {
  const addrRes = await query(`SELECT * FROM addresses WHERE id::text = $1::text AND user_id::text = $2::text`, [String(addressId), String(userId)]);
  if (addrRes.rows.length === 0) {
    throw new ValidationError('Invalid delivery address');
  }
  const addrRow = addrRes.rows[0];
  return {
    id: String(addrRow.id),
    name: addrRow.name,
    street: addrRow.street,
    city: addrRow.city,
    state: addrRow.state,
    postalCode: addrRow.postal_code,
    country: addrRow.country || 'India',
    phone: addrRow.phone || undefined,
    latitude: addrRow.latitude != null ? parseFloat(addrRow.latitude) : undefined,
    longitude: addrRow.longitude != null ? parseFloat(addrRow.longitude) : undefined,
  };
}

async function normalizeTrialPackItemsFromRequest(items) {
  const normalizedItems = [];
  for (const rawItem of items) {
    const productId = rawItem?.productId;
    const variationId = rawItem?.variationId || null;
    if (!productId) {
      throw new ValidationError('Each trial item requires a productId');
    }

    const product = await productModel.getProductById(productId);
    if (!product || product.isActive === false || !product.isMembershipEligible) {
      throw new ValidationError('One or more selected trial products are unavailable');
    }

    let selectedVariation = null;
    if (variationId) {
      const variationRes = await query(
        `SELECT id, size, price_multiplier, price
         FROM product_variations
         WHERE id = $1 AND product_id = $2`,
        [variationId, productId],
      );
      if (variationRes.rows.length === 0) {
        throw new ValidationError('Invalid trial variation selected');
      }
      selectedVariation = variationRes.rows[0];
    }

    const basePerUnitPrice =
      product.sellingPrice !== null && product.sellingPrice !== undefined
        ? Number(product.sellingPrice)
        : Number(product.pricePerLitre);
    const variationMultiplier =
      selectedVariation?.price_multiplier !== null && selectedVariation?.price_multiplier !== undefined
        ? Number(selectedVariation.price_multiplier)
        : 1;
    const perUnitPrice =
      selectedVariation?.price !== null && selectedVariation?.price !== undefined
        ? Number(selectedVariation.price) / variationMultiplier
        : basePerUnitPrice;
    const litresPerDay = resolveTrialLitresPerDay(selectedVariation);
    const totalQty = litresPerDay;
    const totalAmount = roundMoney(perUnitPrice * totalQty);

    normalizedItems.push({
      productId,
      variationId,
      litresPerDay,
      totalQty,
      perUnitPrice,
      totalAmount,
      productName: product.name,
      variationLabel: selectedVariation?.size || null,
    });
  }
  return { normalizedItems };
}

async function buildTrialPackCheckoutBreakdown({ userId, normalizedItems, deliveryAddressJson }) {
  const subtotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.totalAmount, 0));
  const feeRow = await calculateCheckoutFees({
    userId,
    itemsCount: normalizedItems.length,
    deliveryAddress: deliveryAddressJson,
  });
  const platformFee = roundMoney(feeRow.platformFee || 0);
  const deliveryCharges = roundMoney(feeRow.deliveryCharges || 0);
  const total = roundMoney(subtotal + platformFee + deliveryCharges);
  return {
    subtotal,
    platformFee,
    deliveryCharges,
    total,
    isFirstProductOrder: Boolean(feeRow.isFirstProductOrder),
    deliveryDistanceMeters: feeRow.deliveryDistanceMeters ?? null,
  };
}

async function getTrialPackExpectedOrderAmountPaise(razorpayOrderId, userId) {
  const rows = await query(
    `SELECT total_amount, address_id
     FROM subscriptions
     WHERE user_id = $1 AND razorpay_subscription_id = $2 AND is_trial = TRUE`,
    [userId, razorpayOrderId],
  );
  if (rows.rows.length === 0) return null;
  const subtotal = roundMoney(
    rows.rows.reduce((s, r) => s + parseFloat(r.total_amount != null ? r.total_amount : 0), 0),
  );
  const addressId = rows.rows[0].address_id;
  if (addressId == null) return null;
  const addrRes = await query(`SELECT * FROM addresses WHERE id::text = $1::text AND user_id::text = $2::text`, [String(addressId), String(userId)]);
  if (addrRes.rows.length === 0) return null;
  const addrRow = addrRes.rows[0];
  const deliveryAddressJson = {
    id: String(addrRow.id),
    name: addrRow.name,
    street: addrRow.street,
    city: addrRow.city,
    state: addrRow.state,
    postalCode: addrRow.postal_code,
    country: addrRow.country || 'India',
    phone: addrRow.phone || undefined,
    latitude: addrRow.latitude != null ? parseFloat(addrRow.latitude) : undefined,
    longitude: addrRow.longitude != null ? parseFloat(addrRow.longitude) : undefined,
  };
  const feeRow = await calculateCheckoutFees({
    userId,
    itemsCount: rows.rows.length,
    deliveryAddress: deliveryAddressJson,
  });
  const platformFee = roundMoney(feeRow.platformFee || 0);
  const deliveryCharges = roundMoney(feeRow.deliveryCharges || 0);
  const total = roundMoney(subtotal + platformFee + deliveryCharges);
  return Math.max(100, Math.round(total * 100));
}

const estimateTrialPack = async ({ userId, items, addressId, deliveryTime = null }) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('At least one trial item is required');
  }
  if (!addressId) {
    throw new ValidationError('addressId is required');
  }
  const deliveryAddressJson = await loadTrialPackDeliveryAddressJson(userId, addressId);
  await assertSubscriptionPostalCodeServiceable(deliveryAddressJson.postalCode);
  const { normalizedItems } = await normalizeTrialPackItemsFromRequest(items);
  await assertProductsDeliverableToPostalCode(normalizedItems, deliveryAddressJson.postalCode);
  const breakdown = await buildTrialPackCheckoutBreakdown({ userId, normalizedItems, deliveryAddressJson });
  if (!deliveryTime) {
    return { ...breakdown, trialCalendar: null };
  }
  const trialCalendar = await computeTrialPackCalendarAtPurchase({ deliveryTime, client: null });
  return { ...breakdown, trialCalendar };
};

const createTrialPack = async ({ userId, items, addressId, deliveryTime, paymentMethod = 'online' }) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('At least one trial item is required');
  }
  const method = String(paymentMethod || 'online').toLowerCase();
  if (method !== 'online' && method !== 'cod') {
    throw new ValidationError('Invalid payment method for trial pack');
  }
  if (method === 'online' && !hasRazorpayKeys) {
    throw new ValidationError('Online payment is not available. Set Razorpay keys first.');
  }

  await subscriptionModel.ensureSubscriptionSchema();
  await orderModel.ensureOrdersSchema();

  const deliveryAddressJson = await loadTrialPackDeliveryAddressJson(userId, addressId);
  await assertSubscriptionPostalCodeServiceable(deliveryAddressJson.postalCode);
  const { normalizedItems } = await normalizeTrialPackItemsFromRequest(items);
  await assertProductsDeliverableToPostalCode(normalizedItems, deliveryAddressJson.postalCode);
  const checkoutBreakdown = await buildTrialPackCheckoutBreakdown({
    userId,
    normalizedItems,
    deliveryAddressJson,
  });
  const { subtotal, platformFee, deliveryCharges, total } = checkoutBreakdown;

  let trialCheckoutOrderId = null;

  if (method === 'cod') {
    const trialCal = await computeTrialPackCalendarAtPurchase({ deliveryTime });
    // Same line-item shape as cart checkout subscription orders (admin / webhooks use "Subscription for %").
    const computedItems = normalizedItems.map((item) => ({
      productId: item.productId,
      variationId: item.variationId,
      productName: `Subscription for ${item.productName}`,
      variationSize: `Qty: ${item.litresPerDay} L/day | Period: ${trialCal.durationDays} day(s) | Delivery: ${deliveryTime}`,
      unitPrice: item.totalAmount,
      quantity: 1,
      lineTotal: item.totalAmount,
      isSubscription: true,
    }));
    const orderId = crypto.randomUUID();
    const orderNumber = orderId.split('-')[0].toUpperCase();

    const order = await orderModel.createOrder({
      id: orderId,
      userId,
      orderNumber,
      status: 'placed',
      paymentMethod: 'cod',
      paymentStatus: 'cod',
      currency: 'INR',
      subtotal,
      discount: 0,
      platformFee,
      deliveryCharges,
      total,
      deliveryAddress: deliveryAddressJson,
      items: computedItems,
      savingsAmount: 0,
      couponCode: null,
    });
    trialCheckoutOrderId = order.id;

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const createdIds = [];
      for (const item of normalizedItems) {
        const lineTotalQty = item.litresPerDay * trialCal.durationDays;
        const subRes = await client.query(
          `
          INSERT INTO subscriptions (
            user_id, product_id, litres_per_day, duration_months, duration_days, delivery_time,
            address_id, product_variation_id,
            start_date, end_date, razorpay_subscription_id, status,
            total_qty, delivered_qty, remaining_qty, per_unit_price, total_amount, total_amount_paid, wallet_used, platform_fee, purchased_at,
            discount_amount, is_trial, trial_credit_amount, trial_credit_used,
            trial_expires_at,
            payment_method, trial_checkout_order_id,
            first_day_shift_applied, first_day_shift_reason,
            created_at, updated_at
          )
          VALUES (
            $1,$2,$3,1,$4,$5,$6,$7,
            $8::date,$9::date,
            NULL,'pending',
            $10,0,$10,$11,$12,0,0,0,$13,
            0,TRUE,$12,FALSE,
            ($13::timestamptz + INTERVAL '24 hours'),
            'cod',$14,
            $15,$16,
            NOW(),NOW()
          )
          RETURNING id
          `,
          [
            userId,
            item.productId,
            item.litresPerDay,
            trialCal.durationDays,
            deliveryTime,
            addressId,
            item.variationId,
            trialCal.startYmd,
            trialCal.endYmd,
            lineTotalQty,
            item.perUnitPrice,
            item.totalAmount,
            new Date().toISOString(),
            trialCheckoutOrderId,
            trialCal.firstDayShiftApplied,
            trialCal.firstDayShiftReason,
          ],
        );
        createdIds.push(subRes.rows[0].id);
      }
      await client.query('COMMIT');
      const subscriptions = await Promise.all(createdIds.map((id) => subscriptionModel.getSubscriptionById(id)));
      for (let i = 0; i < createdIds.length; i += 1) {
        const id = createdIds[i];
        const sub = subscriptions[i];
        if (sub?.startDate && sub?.endDate) {
          const skipYmd =
            sub.firstDayShiftApplied && sub.startDate
              ? String(sub.startDate).trim().slice(0, 10)
              : null;
          await subscriptionModel.generateDeliverySchedules(
            id,
            sub.startDate,
            sub.endDate,
            skipYmd && /^\d{4}-\d{2}-\d{2}$/.test(skipYmd) ? { skipShiftedFirstDayYmd: skipYmd } : {},
          );
        }
      }
      return {
        subscriptions,
        razorpayOrder: null,
        trialCheckoutOrderId,
        orderTotal: order.total,
        checkoutBreakdown,
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const amountPaise = Math.max(100, Math.round(checkoutBreakdown.total * 100));
    const razorpayOrder = await createOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt: `trial_${Date.now()}_${String(userId).replace(/-/g, '').slice(0, 8)}`,
      notes: {
        userId,
        flow: 'trial_pack',
        trialItemCount: String(normalizedItems.length),
        trialSubtotalInr: String(checkoutBreakdown.subtotal),
        trialPlatformFeeInr: String(checkoutBreakdown.platformFee),
        trialDeliveryInr: String(checkoutBreakdown.deliveryCharges),
        trialTotalInr: String(checkoutBreakdown.total),
      },
    });

    const trialCal = await computeTrialPackCalendarAtPurchase({ deliveryTime, client });

    const createdIds = [];
    for (const item of normalizedItems) {
      const lineTotalQty = item.litresPerDay * trialCal.durationDays;
      const subRes = await client.query(
        `
        INSERT INTO subscriptions (
          user_id, product_id, litres_per_day, duration_months, duration_days, delivery_time,
          address_id, product_variation_id,
          start_date, end_date, razorpay_subscription_id, status,
          total_qty, delivered_qty, remaining_qty, per_unit_price, total_amount, total_amount_paid, wallet_used, platform_fee, purchased_at,
          discount_amount, is_trial, trial_credit_amount, trial_credit_used,
          trial_expires_at,
          payment_method, trial_checkout_order_id,
          first_day_shift_applied, first_day_shift_reason,
          created_at, updated_at
        )
        VALUES (
          $1,$2,$3,1,$4,$5,$6,$7,
          $8::date,$9::date,
          $10,'pending',
          $11,0,$11,$12,$13,0,0,0,$14,
          0,TRUE,$13,FALSE,
          ($14::timestamptz + INTERVAL '24 hours'),
          'online',NULL,
          $15,$16,
          NOW(),NOW()
        )
        RETURNING id
        `,
        [
          userId,
          item.productId,
          item.litresPerDay,
          trialCal.durationDays,
          deliveryTime,
          addressId,
          item.variationId,
          trialCal.startYmd,
          trialCal.endYmd,
          razorpayOrder.id,
          lineTotalQty,
          item.perUnitPrice,
          item.totalAmount,
          new Date().toISOString(),
          trialCal.firstDayShiftApplied,
          trialCal.firstDayShiftReason,
        ],
      );
      createdIds.push(subRes.rows[0].id);
    }

    await client.query('COMMIT');

    const subscriptions = await Promise.all(createdIds.map((id) => subscriptionModel.getSubscriptionById(id)));
    return {
      subscriptions,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderId: razorpayOrder.id,
        key: process.env.RAZORPAY_KEY_ID,
      },
      trialCheckoutOrderId: null,
      checkoutBreakdown,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const activateTrialPackByOrderId = async (razorpayOrderId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  const rows = await query(
    `SELECT id
     FROM subscriptions
     WHERE user_id = $1
       AND razorpay_subscription_id = $2
       AND is_trial = TRUE
     ORDER BY id ASC`,
    [userId, razorpayOrderId],
  );
  if (rows.rows.length === 0) {
    throw new NotFoundError('Trial pack');
  }

  const activated = [];
  for (const row of rows.rows) {
    const subscription = await activateSubscription(row.id);
    activated.push(subscription);
  }
  return activated;
};

/**
 * Link Razorpay recurring for end-of-period renewals only.
 * Does not modify `first_day_shift_*` — the Shifted customer UI stays for the rest of the current period
 * even after AutoPay is linked. Flags clear when a new period starts from successful
 * `applyAutopaySubscriptionRenewalFromPayment`. Set on activate or manual `renewExpiredSubscriptionVerify`.
 */
const setupAutoPay = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  if (!hasRazorpayKeys) {
    throw new ValidationError('Online payment is not available. Set Razorpay keys first.');
  }

  const runRazorpaySetup = async () => {
    const subRes = await query(`SELECT * FROM subscriptions WHERE id = $1`, [subscriptionId]);
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];
    if (String(s.user_id) !== String(userId)) throw new ValidationError('Unauthorized');
    if (s.status !== 'active' && s.status !== 'paused') {
      throw new ValidationError('AutoPay can be set only for active or paused subscriptions');
    }

    const isAlreadyLinked = 
      String(s.razorpay_subscription_id || '').startsWith('sub_') && 
      (s.autopay_status === 'active' || s.autopay_status === 'authenticated');

    if (isAlreadyLinked) {
      return {
        razorpaySubscriptionId: s.razorpay_subscription_id,
        shortUrl: null,
        alreadyLinked: true,
      };
    }

    const endYmd = formatSubscriptionEndDateYmd(s);
    const durationMonths = Math.max(1, parseInt(s.duration_months || 1, 10));
    const planDays = getSubscriptionRenewalDays(s);
    const currentPerUnit = await getCurrentSubscriptionPerUnitPrice(s);

    const baseAmountInr = Math.max(
      0,
      Math.round(currentPerUnit * parseFloat(s.litres_per_day || 0) * planDays)
    );
    const platformFee = await getPlatformFeeAmount();
    const totalAmountInr = roundMoney(baseAmountInr + platformFee);
    const amountPaise = Math.max(101, Math.round(totalAmountInr * 100));

    let startAt = getAutopayFirstChargeUnixSeconds(endYmd);
    const nowSec = Math.floor(Date.now() / 1000);
    if (startAt <= nowSec + 120) {
      startAt = nowSec + 120;
    }

    const plan = await createPlan({
      amount: amountPaise,
      period: 'monthly',
      interval: durationMonths,
      name: `Milko sub #${subscriptionId} renew`,
      description: `AutoPay renewal for subscription #${subscriptionId}`,
      notes: { subscriptionId: String(subscriptionId), userId: String(userId) },
    });

    const rpSub = await createAutoPaySubscription({
      planId: plan.id,
      totalCount: 120,
      startAt,
      notes: { subscriptionId: String(subscriptionId), userId: String(userId) },
    });

    await query(
      `UPDATE subscriptions
       SET razorpay_subscription_id = $1,
           autopay_failure_reason = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [rpSub.id, subscriptionId]
    );

    return {
      razorpaySubscriptionId: rpSub.id,
      shortUrl: rpSub.short_url || null,
      alreadyLinked: false,
    };
  };

  try {
    return await runRazorpaySetup();
  } catch (e1) {
    try {
      return await runRazorpaySetup();
    } catch (e2) {
      // Mid-period AutoPay setup must never end the current subscription term.
      const razorpayMsg =
        e2?.message && String(e2.message).trim() ? String(e2.message).trim() : AUTOPAY_FAILURE_MESSAGE;
      const reason = `AutoPay setup failed: ${razorpayMsg}`;
      await query(
        `UPDATE subscriptions
         SET autopay_failure_reason = $1,
             updated_at = NOW()
         WHERE id = $2 AND status IN ('active', 'paused')`,
        [reason, subscriptionId]
      );
      throw new ValidationError(reason);
    }
  }
};

/**
 * Verify Razorpay AutoPay mandate setup (called after user completes the 2 Rupee authentication).
 */
const verifyAutopaySetup = async (subscriptionId, userId, { razorpay_payment_id, razorpay_subscription_id }) => {
  await subscriptionModel.ensureSubscriptionSchema();
  const sub = await subscriptionModel.getSubscriptionByIdForUser(subscriptionId, userId);
  if (!sub) throw new NotFoundError('Subscription');

  const rpSubId = razorpay_subscription_id || sub.razorpaySubscriptionId;
  if (!rpSubId) throw new ValidationError('No Razorpay subscription ID found');

  // If user completed checkout, we mark as authenticated.
  // Webhook will later update to 'active' when Razorpay processes it.
  await query(
    `UPDATE subscriptions 
     SET autopay_status = 'authenticated', 
         razorpay_subscription_id = $1,
         autopay_failure_reason = NULL,
         updated_at = NOW() 
     WHERE id = $2`,
    [rpSubId, subscriptionId]
  );

  return subscriptionModel.getSubscriptionById(subscriptionId);
};

/**
 * Extend subscription period after Razorpay recurring charge (AutoPay).
 * Idempotent per payment id.
 */
const applyAutopaySubscriptionRenewalFromPayment = async (razorpaySubscriptionId, paymentId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  const payment = await getPayment(paymentId);
  if (payment.status !== 'captured') {
    console.log('[Autopay renewal] Payment not captured', paymentId);
    return null;
  }

  const client = await getClient();
  let milkoSubscriptionId = null;
  try {
    await client.query('BEGIN');
    const subRes = await client.query(
      `SELECT * FROM subscriptions WHERE razorpay_subscription_id = $1 FOR UPDATE`,
      [razorpaySubscriptionId]
    );
    if (subRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const s = subRes.rows[0];
    milkoSubscriptionId = String(s.id);

    if (String(s.razorpay_payment_id || '') === String(paymentId)) {
      await client.query('COMMIT');
      return await subscriptionModel.getSubscriptionById(milkoSubscriptionId);
    }
    if (s.status !== 'active' && s.status !== 'paused') {
      await client.query('ROLLBACK');
      console.log('[Autopay renewal] Skip; status is', s.status);
      return null;
    }

    let variationMultiplier = 1;
    if (s.product_variation_id) {
      const vRes = await client.query(`SELECT price_multiplier FROM product_variations WHERE id = $1`, [s.product_variation_id]);
      if (vRes.rows.length > 0) {
        variationMultiplier = parseFloat(vRes.rows[0].price_multiplier || 1);
      }
    }
    const deliveryCount = Math.max(1, getDeliveryCount(s.frequency || 'daily', planDays));
    const totalQty = parseFloat(s.litres_per_day || 0) * variationMultiplier * deliveryCount;
    const currentPerUnit = await getCurrentSubscriptionPerUnitPrice(s);
    const baseAmount = currentPerUnit * totalQty;
    const platformFee = await getPlatformFeeAmount();
    const finalTotal = roundMoney(baseAmount + platformFee);

    // Calculate Savings for renewal
    let renewalSavings = 0;
    try {
      const prodRes = await client.query(`SELECT compare_at_price FROM products WHERE id = $1`, [s.product_id]);
      const p = prodRes.rows[0];
      let varCompare = null;
      let mult = 1;
      if (s.product_variation_id) {
        const vRes = await client.query(`SELECT compare_at_price, price_multiplier FROM product_variations WHERE id = $1`, [s.product_variation_id]);
        if (vRes.rows.length > 0) {
          varCompare = vRes.rows[0].compare_at_price !== null ? parseFloat(vRes.rows[0].compare_at_price) : null;
          mult = vRes.rows[0].price_multiplier !== null ? parseFloat(vRes.rows[0].price_multiplier) : 1;
        }
      }
      const baseCompare = p?.compare_at_price !== null && p?.compare_at_price !== undefined ? parseFloat(p.compare_at_price) : null;
      const originalUnitPrice = varCompare !== null ? varCompare : (baseCompare !== null ? baseCompare * mult : null);
      if (originalUnitPrice !== null && originalUnitPrice > (currentPerUnit * variationMultiplier)) {
        renewalSavings = (originalUnitPrice - (currentPerUnit * variationMultiplier)) * parseFloat(s.litres_per_day || 0) * deliveryCount;
      }
    } catch (err) {
      console.warn('[Autopay renewal] Savings calc failed', err.message);
    }

    await client.query(
      `
      UPDATE subscriptions
      SET status = 'active',
          initial_start_date = COALESCE(initial_start_date, start_date),
          start_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
          end_date   = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + ($1::integer - 1),
          renewed_at = NOW(),
          renewal_order_id = NULL,
          razorpay_payment_id = $2,
          total_qty = $3,
          delivered_qty = 0,
          remaining_qty = $3,
          total_amount = $4,
          total_amount_paid = $5,
          platform_fee = $6,
          savings_amount = $8,
          autopay_failure_reason = NULL,
          first_day_shift_applied = FALSE,
          first_day_shift_reason = NULL,
          trial_shifted = FALSE,
          updated_at = NOW()
      WHERE id = $7
      `,
      [planDays, paymentId, totalQty, baseAmount, finalTotal, platformFee, milkoSubscriptionId, renewalSavings]
    );

    // Update user lifetime savings
    await client.query(`UPDATE users SET lifetime_savings = lifetime_savings + $1, updated_at = NOW() WHERE id = $2`, [renewalSavings, s.user_id]);


    await client.query(`DELETE FROM paused_dates WHERE subscription_id = $1`, [milkoSubscriptionId]);
    await client.query(`DELETE FROM delivery_schedules WHERE subscription_id = $1`, [milkoSubscriptionId]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const renewed = await subscriptionModel.getSubscriptionById(milkoSubscriptionId);
  await subscriptionModel.generateDeliverySchedules(
    milkoSubscriptionId,
    renewed.startDate,
    renewed.endDate
  );

  return await subscriptionModel.getSubscriptionById(milkoSubscriptionId);
};

/**
 * Remove AutoPay: cancel Razorpay recurring subscription and clear local link.
 * Does not modify `first_day_shift_*`.
 */
const removeAutoPay = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  if (!hasRazorpayKeys) {
    throw new ValidationError('Online payment is not available. Set Razorpay keys first.');
  }

  const sub = await subscriptionModel.getSubscriptionById(subscriptionId);
  if (!sub) throw new NotFoundError('Subscription');
  if (String(sub.userId) !== String(userId)) throw new ValidationError('Unauthorized');
  if (sub.status !== 'active' && sub.status !== 'paused') {
    throw new ValidationError('AutoPay can only be removed for active or paused subscriptions');
  }

  const rpId = sub.razorpaySubscriptionId;
  if (!rpId || !String(rpId).startsWith('sub_')) {
    throw new ValidationError('No AutoPay mandate is linked');
  }

  try {
    await cancelRazorpaySubscription(rpId);
  } catch (e) {
    console.warn('[removeAutoPay] Razorpay cancel failed; clearing local link anyway:', e?.message || e);
  }

  await query(
    `UPDATE subscriptions SET razorpay_subscription_id = NULL, autopay_status = NULL, updated_at = NOW() WHERE id = $1`,
    [subscriptionId]
  );

  return subscriptionModel.getSubscriptionById(subscriptionId);
};

const renewExpiredSubscriptionInit = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  if (!hasRazorpayKeys) {
    throw new ValidationError('Online payment is not available. Set Razorpay keys first.');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const subRes = await client.query(
      `SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE`,
      [subscriptionId]
    );
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];
    if (String(s.user_id) !== String(userId)) throw new ValidationError('Unauthorized');
    if (s.status !== 'expired') throw new ValidationError('Only expired subscriptions can be renewed here');

    const planDays = getSubscriptionRenewalDays(s);
    const currentPerUnit = await getCurrentSubscriptionPerUnitPrice(s);
    let variationMultiplier = 1;
    if (s.product_variation_id) {
      const vRes = await client.query(`SELECT price_multiplier FROM product_variations WHERE id = $1`, [s.product_variation_id]);
      if (vRes.rows.length > 0) {
        variationMultiplier = parseFloat(vRes.rows[0].price_multiplier || 1);
      }
    }
    const deliveryCount = Math.max(1, getDeliveryCount(s.frequency || 'daily', planDays));
    const baseAmountInr = Math.max(
      0,
      Math.round(currentPerUnit * parseFloat(s.litres_per_day || 0) * variationMultiplier * deliveryCount)
    );
    const platformFee = await getPlatformFeeAmount();
    const finalTotal = roundMoney(baseAmountInr + platformFee);

    const razorpayOrder = await createOrder({
      amount: Math.round(finalTotal * 100),
      currency: 'INR',
      receipt: `renew_${Date.now()}_${String(userId).replace(/-/g, '').slice(0, 8)}`,
      notes: {
        subscriptionId: String(subscriptionId),
        userId: String(userId),
        flow: 'renew_expired',
      },
    });

    await client.query(
      `UPDATE subscriptions SET renewal_order_id = $1, updated_at = NOW() WHERE id = $2`,
      [razorpayOrder.id, subscriptionId]
    );

    await client.query('COMMIT');
    return {
      subscriptionId: String(subscriptionId),
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderId: razorpayOrder.id,
        key: process.env.RAZORPAY_KEY_ID,
      },
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const renewExpiredSubscriptionVerify = async (subscriptionId, userId, razorpayOrderId, razorpayPaymentId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  const payment = await getPayment(razorpayPaymentId);
  if (payment.status !== 'captured') throw new ValidationError('Payment not captured');
  if (payment.order_id !== razorpayOrderId) throw new ValidationError('Order ID mismatch');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const subRes = await client.query(
      `SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE`,
      [subscriptionId]
    );
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];
    if (String(s.user_id) !== String(userId)) throw new ValidationError('Unauthorized');
    if (s.status !== 'expired') throw new ValidationError('Subscription is not expired');
    if (!s.renewal_order_id || s.renewal_order_id !== razorpayOrderId) {
      throw new ValidationError('Invalid renewal order');
    }

    let variationMultiplier = 1;
    if (s.product_variation_id) {
      const vRes = await client.query(`SELECT price_multiplier FROM product_variations WHERE id = $1`, [s.product_variation_id]);
      if (vRes.rows.length > 0) {
        variationMultiplier = parseFloat(vRes.rows[0].price_multiplier || 1);
      }
    }
    const baseDeliveryCount = Math.max(1, getDeliveryCount(s.frequency || 'daily', basePlanDays));
    const activeDeliveryCount = Math.max(1, getDeliveryCount(s.frequency || 'daily', planDays));
    const totalQty = litres * variationMultiplier * activeDeliveryCount;
    const baseAmount = perUnit * litres * variationMultiplier * baseDeliveryCount;
    const platformFee = await getPlatformFeeAmount();
    const finalTotal = roundMoney(baseAmount + platformFee);

    // Calculate Savings for renewal
    let renewalSavings = 0;
    try {
      const prodRes = await client.query(`SELECT compare_at_price FROM products WHERE id = $1`, [s.product_id]);
      const p = prodRes.rows[0];
      let varCompare = null;
      let mult = 1;
      if (s.product_variation_id) {
        const vRes = await client.query(`SELECT compare_at_price, price_multiplier FROM product_variations WHERE id = $1`, [s.product_variation_id]);
        if (vRes.rows.length > 0) {
          varCompare = vRes.rows[0].compare_at_price !== null ? parseFloat(vRes.rows[0].compare_at_price) : null;
          mult = vRes.rows[0].price_multiplier !== null ? parseFloat(vRes.rows[0].price_multiplier) : 1;
        }
      }
      const baseCompare = p?.compare_at_price !== null && p?.compare_at_price !== undefined ? parseFloat(p.compare_at_price) : null;
      const originalUnitPrice = varCompare !== null ? varCompare : (baseCompare !== null ? baseCompare * mult : null);
      if (originalUnitPrice !== null && originalUnitPrice > (perUnit * variationMultiplier)) {
        renewalSavings = (originalUnitPrice - (perUnit * variationMultiplier)) * litres * baseDeliveryCount;
      }
    } catch (err) {
      console.warn('[Manual renewal] Savings calc failed', err.message);
    }

    await client.query(
      `
      UPDATE subscriptions
      SET status = 'active',
          initial_start_date = COALESCE(initial_start_date, start_date),
          start_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
          end_date   = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + ($1::integer - 1),
          renewed_at = NOW(),
          renewal_order_id = NULL,
          razorpay_payment_id = $2,
          per_unit_price = $8,
          duration_days = $1,
          total_qty = $3,
          delivered_qty = 0,
          remaining_qty = $3,
          total_amount = $4,
          total_amount_paid = $5,
          platform_fee = $6,
          savings_amount = $11,
          first_day_shift_applied = $9,
          first_day_shift_reason = $10,
          trial_shifted = FALSE,
          updated_at = NOW()
      WHERE id = $7
      `,
      [planDays, razorpayPaymentId, totalQty, baseAmount, finalTotal, platformFee, subscriptionId, perUnit, bonusDays > 0, reason, renewalSavings]
    );

    // Update user lifetime savings
    await client.query(`UPDATE users SET lifetime_savings = lifetime_savings + $1, updated_at = NOW() WHERE id = $2`, [renewalSavings, userId]);


    await client.query(`DELETE FROM paused_dates WHERE subscription_id = $1`, [subscriptionId]);
    await client.query(`DELETE FROM delivery_schedules WHERE subscription_id = $1`, [subscriptionId]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const renewed = await subscriptionModel.getSubscriptionById(subscriptionId);
  const skipRenewShiftYmd =
    renewed.firstDayShiftApplied && renewed.startDate
      ? String(renewed.startDate).trim().slice(0, 10)
      : null;
  await subscriptionModel.generateDeliverySchedules(
    subscriptionId,
    renewed.startDate,
    renewed.endDate,
    skipRenewShiftYmd && /^\d{4}-\d{2}-\d{2}$/.test(skipRenewShiftYmd)
      ? { skipShiftedFirstDayYmd: skipRenewShiftYmd }
      : {},
  );

  return await subscriptionModel.getSubscriptionById(subscriptionId);
};

/**
 * Use saved `addresses.id` from cart payload when valid; otherwise insert a snapshot from `orders.delivery_address`.
 * @param {*} client - pooled PG client (same transaction as subscription insert)
 * @param {string} orderId
 * @param {string} userId
 * @returns {Promise<number|null>}
 */
async function resolveOrCreateAddressIdFromOrderDeliveryJson(client, orderId, userId) {
  const r = await client.query(
    `SELECT delivery_address FROM orders WHERE id::text = $1::text AND user_id::text = $2::text LIMIT 1`,
    [String(orderId), String(userId)]
  );
  const raw = r.rows[0]?.delivery_address;
  if (raw == null) return null;
  let addr;
  if (typeof raw === 'string') {
    try {
      addr = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    addr = raw;
  }
  if (!addr || typeof addr !== 'object') return null;
  await addressModel.ensureAddressSchema();

  const parseRefId = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  };
  const refCandidates = [addr.id, addr.addressId, addr.address_id, addr.savedAddressId];
  for (const c of refCandidates) {
    const refId = parseRefId(c);
    if (refId == null) continue;
    const ok = await client.query(`SELECT id FROM addresses WHERE id::text = $1::text AND user_id::text = $2::text`, [String(refId), String(userId)]);
    if (ok.rows.length > 0) return refId;
  }

  const name = String(addr.name || addr.label || 'Delivery').trim() || 'Delivery';
  const street = String(addr.street || '').trim() || '-';
  const city = String(addr.city || '').trim() || '-';
  const state = String(addr.state || '').trim() || '-';
  const postalRaw =
    addr.postalCode != null && String(addr.postalCode).trim() !== ''
      ? addr.postalCode
      : addr.postal_code != null && String(addr.postal_code).trim() !== ''
        ? addr.postal_code
        : '';
  const postalCode = String(postalRaw).trim() || '-';
  const country = String(addr.country || 'India').trim() || 'India';
  const phone = addr.phone != null && String(addr.phone).trim() !== '' ? String(addr.phone).trim() : null;
  const latRaw = addr.latitude != null ? addr.latitude : addr.lat;
  const lngRaw = addr.longitude != null ? addr.longitude : addr.lng;
  const lat = latRaw != null && String(latRaw).trim() !== '' ? Number(latRaw) : null;
  const lng = lngRaw != null && String(lngRaw).trim() !== '' ? Number(lngRaw) : null;

  const ins = await client.query(
    `
    INSERT INTO addresses (user_id, name, type, street, street_address, city, state, postal_code, country, phone, latitude, longitude, is_default, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,NOW(),NOW())
    RETURNING id
    `,
    [
      userId,
      name,
      name,
      street,
      street,
      city,
      state,
      postalCode,
      country,
      phone,
      Number.isFinite(lat) ? lat : null,
      Number.isFinite(lng) ? lng : null,
    ]
  );
  const newId = ins.rows[0]?.id;
  return newId != null ? parseInt(String(newId), 10) : null;
}

/**
 * Create/activate subscription from a paid checkout order that contains a subscription line item.
 * Idempotent by checkout_order_id.
 */
const createFromCheckoutOrder = async (orderId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  await walletService.ensureWalletSchema();
  await addressModel.ensureAddressSchema();
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT id, status, address_id FROM subscriptions WHERE checkout_order_id::text = $1::text LIMIT 1`,
      [String(orderId)]
    );
    if (existingRes.rows.length > 0) {
      const existingId = existingRes.rows[0].id;
      const existingStatus = existingRes.rows[0].status;
      const existingAddrId = existingRes.rows[0].address_id;
      const payRes = await client.query(
        `SELECT payment_status, user_id FROM orders WHERE id::text = $1::text LIMIT 1`,
        [String(orderId)]
      );
      const orderUserId = payRes.rows[0]?.user_id;
      if (existingAddrId == null && orderUserId) {
        const resolved = await resolveOrCreateAddressIdFromOrderDeliveryJson(client, orderId, orderUserId);
        if (resolved != null) {
          await client.query(`UPDATE subscriptions SET address_id = $1, updated_at = NOW() WHERE id = $2`, [
            resolved,
            existingId,
          ]);
        }
      }
      await client.query('COMMIT');
      const ps = String(payRes.rows[0]?.payment_status || '').toLowerCase();
      if (existingStatus !== 'active' && ps === 'paid') {
        return await activateSubscription(existingId);
      }
      return await subscriptionModel.getSubscriptionById(existingId);
    }

    const orderRes = await client.query(
      `
      SELECT id, user_id, payment_status, created_at, payment_method
      FROM orders
      WHERE id::text = $1::text
      LIMIT 1
      `,
      [String(orderId)]
    );
    if (orderRes.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }
    const order = orderRes.rows[0];

    const itemRes = await client.query(
      `
      SELECT product_id, product_name, variation_size, unit_price, variation_id
      FROM order_items
      WHERE order_id::text = $1::text
        AND LOWER(product_name) LIKE 'subscription for %'
      ORDER BY created_at ASC
      LIMIT 1
      `,
      [String(orderId)]
    );
    if (itemRes.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const item = itemRes.rows[0];
    const details = String(item.variation_size || '');
    const qtyMatch = details.match(/Qty:\s*([0-9]+(?:\.[0-9]+)?)\s*L\/day/i);
    const daysMatch = details.match(/Period:\s*([0-9]+)\s*day/i);
    const monthsMatch = details.match(/Period:\s*([0-9]+)\s*month/i);
    const deliveryMatch = details.match(/Delivery:\s*([^|]+)/i);
    const freqMatch = details.match(/Frequency:\s*([a-zA-Z]+)/i);

    const litresPerDay = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
    let planDays = 0;
    if (daysMatch) {
      planDays = Math.max(1, parseInt(daysMatch[1], 10));
    } else if (monthsMatch) {
      planDays = Math.max(1, Math.round(parseInt(monthsMatch[1], 10) * 30));
    }
    const durationMonthsForDb = Math.max(1, Math.round(planDays / 30));
    const deliveryTime = deliveryMatch ? String(deliveryMatch[1]).trim() : '';
    const frequency = freqMatch ? freqMatch[1].trim().toLowerCase() : 'daily';
    if (!item.product_id || !litresPerDay || !planDays || !deliveryTime) {
      await client.query('COMMIT');
      return null;
    }

    let variationMultiplier = 1;
    if (item.variation_id) {
      const varRes = await client.query(`SELECT price_multiplier FROM product_variations WHERE id = $1`, [item.variation_id]);
      if (varRes.rows.length > 0) {
        variationMultiplier = parseFloat(varRes.rows[0].price_multiplier || 1);
      }
    }
    const deliveryCount = Math.max(1, getDeliveryCount(frequency, planDays));
    const totalQty = litresPerDay * variationMultiplier * deliveryCount;
    const totalAmount = parseFloat(item.unit_price || 0);
    const perUnitPrice = totalQty > 0 ? (totalAmount / totalQty) : 0;
    // COD uses payment_status 'cod' until collection — do not treat as paid here.
    const isAlreadyPaid = String(order.payment_status || '').toLowerCase() === 'paid';
    const purchasedAtIso = isAlreadyPaid
      ? new Date().toISOString()
      : order.created_at
        ? new Date(order.created_at).toISOString()
        : new Date().toISOString();

    const orderPmRaw = String(order.payment_method || 'online').trim().toLowerCase();
    const subscriptionPaymentMethod = ['cod', 'online', 'wallet'].includes(orderPmRaw) ? orderPmRaw : 'online';

    const resolvedAddressId = await resolveOrCreateAddressIdFromOrderDeliveryJson(client, orderId, order.user_id);

    // start_date and end_date computed entirely in PostgreSQL (Asia/Kolkata) — no Node host-TZ skew.
    const insertRes = await client.query(
      `
      INSERT INTO subscriptions (
        user_id, product_id, litres_per_day, duration_months, duration_days, delivery_time,
        product_variation_id, address_id,
        start_date, end_date, razorpay_subscription_id, status, checkout_order_id,
        total_qty, delivered_qty, remaining_qty, per_unit_price, total_amount, total_amount_paid, wallet_used, platform_fee, purchased_at,
        payment_method, frequency,
        created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + ($5::integer - 1),
        NULL,'pending',$9,
        $10,0,$10,$11,$12,$13,0,0,$14,
        $15,$16,
        NOW(),NOW()
      )
      RETURNING id
      `,
      [
        order.user_id,
        item.product_id,
        litresPerDay,
        durationMonthsForDb,
        planDays,
        deliveryTime,
        item.variation_id || null,
        resolvedAddressId,
        orderId,
        totalQty,
        perUnitPrice,
        totalAmount,
        isAlreadyPaid ? totalAmount : 0,
        purchasedAtIso,
        subscriptionPaymentMethod,
        frequency,
      ]
    );

    const subscriptionId = insertRes.rows[0].id;
    await client.query('COMMIT');

    if (isAlreadyPaid) {
      return await activateSubscription(subscriptionId);
    }
    const createdPending = await subscriptionModel.getSubscriptionById(subscriptionId);
    if (createdPending?.startDate && createdPending?.endDate) {
      await subscriptionModel.generateDeliverySchedules(
        subscriptionId,
        createdPending.startDate,
        createdPending.endDate,
        {},
      );
    }
    return await subscriptionModel.getSubscriptionById(subscriptionId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

/**
 * After checkout COD: subscription stays pending until admin marks the order delivered.
 * Idempotent â€” no-op if no linked subscription or already active.
 */
const activateSubscriptionForCheckoutOrderIfPending = async (orderId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  const res = await query(
    `SELECT id, status FROM subscriptions WHERE checkout_order_id::text = $1::text LIMIT 1`,
    [String(orderId)]
  );
  if (res.rows.length === 0) return null;
  if (String(res.rows[0].status || '').toLowerCase() === 'active') {
    return await subscriptionModel.getSubscriptionById(res.rows[0].id);
  }
  return await activateSubscription(res.rows[0].id);
};

/**
 * After COD trial pack order is marked delivered: activate all pending trial rows linked to that order.
 */
const activateTrialSubscriptionsForTrialOrderIfPending = async (orderId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  const res = await query(
    `SELECT id, status FROM subscriptions WHERE trial_checkout_order_id::text = $1::text AND is_trial = TRUE ORDER BY id ASC`,
    [String(orderId)],
  );
  if (!res.rows.length) return [];
  const activated = [];
  for (const row of res.rows) {
    if (String(row.status || '').toLowerCase() === 'pending') {
      activated.push(await activateSubscription(row.id));
    } else {
      activated.push(await subscriptionModel.getSubscriptionById(row.id));
    }
  }
  return activated;
};

module.exports = {
  AUTOPAY_FAILURE_MESSAGE,
  createSubscription,
  activateSubscription,
  createFromCheckoutOrder,
  activateSubscriptionForCheckoutOrderIfPending,
  activateTrialSubscriptionsForTrialOrderIfPending,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  cancelTodaysDelivery,
  createTrialPack,
  estimateTrialPack,
  getTrialPackExpectedOrderAmountPaise,
  activateTrialPackByOrderId,
  setupAutoPay,
  verifyAutopaySetup,
  removeAutoPay,
  applyAutopaySubscriptionRenewalFromPayment,
  renewExpiredSubscriptionInit,
  renewExpiredSubscriptionVerify,
};
