-- Per-variation compare-at (strikethrough / "was" price) for discount display.
ALTER TABLE product_variations
ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10, 2);
