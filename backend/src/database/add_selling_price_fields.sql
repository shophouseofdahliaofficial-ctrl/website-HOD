-- Add selling_price and compare_at_price columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10, 2);

-- Add index for price queries
CREATE INDEX IF NOT EXISTS idx_products_selling_price ON products(selling_price);
