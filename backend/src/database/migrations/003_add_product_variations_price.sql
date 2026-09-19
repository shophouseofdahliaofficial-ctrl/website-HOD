-- ============================================
-- Migration: 003_add_product_variations_price
-- Adds explicit per-variation price (admin UI); table may exist from 002 without this column.
-- ============================================

ALTER TABLE product_variations
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);

-- Backfill NULL prices from product base price × multiplier (prefer selling_price)
UPDATE product_variations pv
SET price = ROUND(
  (COALESCE(p.selling_price, p.price_per_litre) * pv.price_multiplier)::numeric,
  2
)
FROM products p
WHERE p.id = pv.product_id
  AND pv.price IS NULL;
