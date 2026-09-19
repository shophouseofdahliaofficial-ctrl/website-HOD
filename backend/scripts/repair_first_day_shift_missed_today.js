/**
 * One-off repair: subscriptions that should have first-day slot shift (+1 day, skip start_date in schedules)
 * but have first_day_shift_applied = false — typically after the UTC/local TIME parsing bug.
 *
 * Default scope: start_date = calendar "today" in SUBSCRIPTION_CALENDAR_TZ (Asia/Kolkata), non-trial,
 * status active or pending, no deliveries recorded yet (delivered_qty = 0).
 *
 * Usage (from milko-backend-main, with .env / DATABASE_URL set):
 *   node scripts/repair_first_day_shift_missed_today.js --dry-run
 *   node scripts/repair_first_day_shift_missed_today.js
 *   node scripts/repair_first_day_shift_missed_today.js --date=2026-05-04 --dry-run
 *   node scripts/repair_first_day_shift_missed_today.js --verbose --dry-run
 *
 * If slot rules return 0 bonus (e.g. delivery_time does not match admin slot `value` strings) but you
 * still want every eligible row to get +1 day and first-day schedule skip, use:
 *   node scripts/repair_first_day_shift_missed_today.js --force --dry-run
 *   node scripts/repair_first_day_shift_missed_today.js --force
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { query, getClient } = require('../src/config/database');
const subscriptionModel = require('../src/models/subscription');
const { computeFirstDayShiftBonus, extractSlotStartKey } = require('../src/services/subscriptionSlotShift');

const TZ = process.env.SUBSCRIPTION_CALENDAR_TZ || 'Asia/Kolkata';

function pgZoneForSql() {
  const z = String(TZ || 'Asia/Kolkata').trim();
  if (!/^[\w/.+-]+$/.test(z) || z.length > 63) return 'Asia/Kolkata';
  return z;
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const verbose = argv.includes('--verbose');
  const force = argv.includes('--force');
  let dateYmd = null;
  for (const a of argv) {
    if (a.startsWith('--date=')) dateYmd = a.slice('--date='.length).trim();
  }
  return { dryRun, dateYmd, verbose, force };
}

async function main() {
  const { dryRun, dateYmd: dateArg, verbose, force } = parseArgs(process.argv.slice(2));
  const zone = pgZoneForSql();

  let anchorYmd = dateArg;
  if (!anchorYmd || !/^\d{4}-\d{2}-\d{2}$/.test(anchorYmd)) {
    const r = await query(`SELECT (CURRENT_TIMESTAMP AT TIME ZONE $1)::date::text AS ymd`, [zone]);
    anchorYmd = r.rows[0]?.ymd;
  }
  if (!anchorYmd || !/^\d{4}-\d{2}-\d{2}$/.test(anchorYmd)) {
    throw new Error('Could not resolve anchor calendar date');
  }

  console.log(`[repair-first-day-shift] anchor start_date = ${anchorYmd} (${zone}) dryRun=${dryRun} force=${force}`);
  if (force) {
    console.warn('[repair-first-day-shift] --force: applying +1 day to every candidate (ignores slot-time check).');
  }

  await subscriptionModel.ensureSubscriptionSchema();

  const listRes = await query(
    `
    SELECT s.*
    FROM subscriptions s
    WHERE s.start_date = $1::date
      AND s.status IN ('active', 'pending')
      AND (s.first_day_shift_applied IS DISTINCT FROM TRUE)
      AND (s.is_trial IS DISTINCT FROM TRUE)
      AND COALESCE(s.delivered_qty, 0) = 0
      AND NOT EXISTS (
        SELECT 1 FROM delivery_schedules ds
        WHERE ds.subscription_id = s.id AND LOWER(ds.status::text) = 'delivered'
      )
    ORDER BY s.id ASC
    `,
    [anchorYmd]
  );

  const rows = listRes.rows || [];
  console.log(`[repair-first-day-shift] candidates: ${rows.length}`);

  let fixed = 0;
  let skipped = 0;

  for (const s of rows) {
    let activationInstant = new Date();
    if (s.checkout_order_id) {
      const o = await query(`SELECT created_at FROM orders WHERE id = $1 LIMIT 1`, [s.checkout_order_id]);
      const ct = o.rows[0]?.created_at;
      if (ct) activationInstant = new Date(ct);
    } else {
      const pi = s.purchased_at || s.created_at;
      if (pi) activationInstant = new Date(pi);
    }

    const shift = force
      ? { bonusDays: 1, reason: 'retrofit_forced' }
      : await computeFirstDayShiftBonus({
          deliveryTime: s.delivery_time,
          activationInstant,
        });

    if (!force && (!shift || (Number(shift.bonusDays) || 0) < 1)) {
      if (verbose) {
        const dk = extractSlotStartKey(s.delivery_time);
        console.log(
          `[skip] id=${s.id} bonusDays=${shift?.bonusDays ?? 'n/a'} reason=${shift?.reason ?? 'n/a'} deliveryKey=${dk ?? 'null'} activation=${activationInstant.toISOString()}`
        );
      }
      skipped += 1;
      continue;
    }

    const baseDays = Math.max(1, parseInt(s.duration_days, 10) || 1);
    const newDays = baseDays + shift.bonusDays;
    const litres = parseFloat(s.litres_per_day || 0);
    const newTotalQty = litres * newDays;
    const startYmd = anchorYmd;

    console.log(
      `[apply] id=${s.id} user=${s.user_id} status=${s.status} baseDays=${baseDays} -> ${newDays} reason=${shift.reason} checkout_order_id=${s.checkout_order_id || 'null'}`
    );

    if (dryRun) {
      fixed += 1;
      continue;
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM delivery_schedules WHERE subscription_id = $1`, [s.id]);
      await client.query(
        `
        UPDATE subscriptions
        SET duration_days = $2,
            end_date = start_date + ($2::integer - 1) * INTERVAL '1 day',
            total_qty = $3,
            remaining_qty = $3,
            first_day_shift_applied = TRUE,
            first_day_shift_reason = $4,
            updated_at = NOW()
        WHERE id = $1
        `,
        [s.id, newDays, newTotalQty, shift.reason || 'retrofit_slot_shift']
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`[error] id=${s.id}`, e);
      throw e;
    } finally {
      client.release();
    }

    const endRes = await query(`SELECT end_date::text AS end_ymd FROM subscriptions WHERE id = $1`, [s.id]);
    const endYmd = String(endRes.rows[0]?.end_ymd || '')
      .trim()
      .slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) {
      console.error(`[error] id=${s.id} bad end_date after update`);
      throw new Error(`bad end_date for subscription ${s.id}`);
    }

    await subscriptionModel.generateDeliverySchedules(s.id, startYmd, endYmd, {
      skipShiftedFirstDayYmd: startYmd,
    });
    fixed += 1;
  }

  console.log(`[repair-first-day-shift] done fixed=${fixed} skipped_no_shift_or_other=${skipped} dryRun=${dryRun}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
