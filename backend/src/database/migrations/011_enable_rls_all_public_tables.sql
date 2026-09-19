-- Enable Row Level Security on all public application tables.
-- Milko uses the Render backend with a direct Postgres connection (postgres role),
-- which bypasses RLS. The frontend only uses Supabase Auth, not PostgREST.
-- Enabling RLS blocks anon/authenticated API access to sensitive tables.

-- ---------------------------------------------------------------------------
-- 1) Enable RLS on every public table
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) User-owned data policies (safe if you ever query via Supabase client)
-- ---------------------------------------------------------------------------

-- users: read own profile only
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- addresses: manage own addresses
DROP POLICY IF EXISTS addresses_select_own ON public.addresses;
CREATE POLICY addresses_select_own ON public.addresses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_insert_own ON public.addresses;
CREATE POLICY addresses_insert_own ON public.addresses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_update_own ON public.addresses;
CREATE POLICY addresses_update_own ON public.addresses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_delete_own ON public.addresses;
CREATE POLICY addresses_delete_own ON public.addresses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- subscriptions (004_wallet_and_rls.sql may already exist)
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- wallet_transactions
DROP POLICY IF EXISTS wallet_transactions_select_own ON public.wallet_transactions;
CREATE POLICY wallet_transactions_select_own ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- orders
DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- order_items via parent order
DROP POLICY IF EXISTS order_items_select_own ON public.order_items;
CREATE POLICY order_items_select_own ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
    )
  );

-- order_feedback
DROP POLICY IF EXISTS order_feedback_select_own ON public.order_feedback;
CREATE POLICY order_feedback_select_own ON public.order_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS order_feedback_insert_own ON public.order_feedback;
CREATE POLICY order_feedback_insert_own ON public.order_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS order_feedback_update_own ON public.order_feedback;
CREATE POLICY order_feedback_update_own ON public.order_feedback
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- delivery_schedules via subscription
DROP POLICY IF EXISTS delivery_schedules_select_own ON public.delivery_schedules;
CREATE POLICY delivery_schedules_select_own ON public.delivery_schedules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = delivery_schedules.subscription_id
        AND s.user_id = auth.uid()
    )
  );

-- paused_dates via subscription
DROP POLICY IF EXISTS paused_dates_select_own ON public.paused_dates;
CREATE POLICY paused_dates_select_own ON public.paused_dates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = paused_dates.subscription_id
        AND s.user_id = auth.uid()
    )
  );

-- payments via subscription
DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = payments.subscription_id
        AND s.user_id = auth.uid()
    )
  );

-- product_reviews: public read for approved only; users manage own
DROP POLICY IF EXISTS product_reviews_select_approved ON public.product_reviews;
CREATE POLICY product_reviews_select_approved ON public.product_reviews
  FOR SELECT
  USING (is_approved = true);

DROP POLICY IF EXISTS product_reviews_insert_own ON public.product_reviews;
CREATE POLICY product_reviews_insert_own ON public.product_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS product_reviews_update_own ON public.product_reviews;
CREATE POLICY product_reviews_update_own ON public.product_reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- google_connectors, coupons, verifications: RLS on, no policies = API denied

-- ---------------------------------------------------------------------------
-- 3) Public catalog read (optional — only active products/banners/content)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS products_select_active ON public.products;
CREATE POLICY products_select_active ON public.products
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS product_images_select ON public.product_images;
CREATE POLICY product_images_select ON public.product_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS product_variations_select ON public.product_variations;
CREATE POLICY product_variations_select ON public.product_variations
  FOR SELECT
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variations.product_id
        AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS banners_select_active ON public.banners;
CREATE POLICY banners_select_active ON public.banners
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS site_content_select ON public.site_content;
CREATE POLICY site_content_select ON public.site_content
  FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- 4) Tighten grants — backend uses postgres role; auth trigger uses SECURITY DEFINER
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- RLS policies above still restrict what each role can actually read/write.
