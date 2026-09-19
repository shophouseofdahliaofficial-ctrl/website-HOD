-- Trial pack COD: link subscriptions to checkout order and record payment channel.
-- (Also applied via ensureSubscriptionSchema on API boot.)

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'online';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_checkout_order_id UUID;

COMMENT ON COLUMN subscriptions.payment_method IS 'online | cod | wallet (subscription purchase channel)';
COMMENT ON COLUMN subscriptions.trial_checkout_order_id IS 'When set, COD trial rows share this orders.id; admin mark-delivered activates all.';
