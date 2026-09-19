-- Shipping weight (kg) for products and variations — used by checkout / Shiprocket.

ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3);
ALTER TABLE product_variations ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3);

COMMENT ON COLUMN products.weight IS 'Product weight in kg for shipping calculations';
COMMENT ON COLUMN product_variations.weight IS 'Variation weight in kg; overrides product weight when set';
