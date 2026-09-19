-- Pending COD trial subscriptions created before delivery_schedules were generated at checkout:
-- add one pending row per subscription day range so they appear in admin subscription deliveries.

INSERT INTO delivery_schedules (subscription_id, delivery_date, status, created_at)
SELECT s.id, s.start_date::date, 'pending', NOW()
FROM subscriptions s
WHERE s.is_trial IS TRUE
  AND s.status = 'pending'
  AND s.trial_checkout_order_id IS NOT NULL
  AND LOWER(COALESCE(s.payment_method, '')) = 'cod'
  AND NOT EXISTS (SELECT 1 FROM delivery_schedules ds WHERE ds.subscription_id = s.id)
ON CONFLICT (subscription_id, delivery_date) DO NOTHING;
