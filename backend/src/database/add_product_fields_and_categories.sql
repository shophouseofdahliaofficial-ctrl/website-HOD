-- Add new fields to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS category_id INTEGER;

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for category_id (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_products_category'
    ) THEN
        ALTER TABLE products
        ADD CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for category lookups
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Update product_variations to use price instead of price_multiplier (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'product_variations'
    ) THEN
        -- Add the new price column
        ALTER TABLE product_variations
        ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);

        -- Migrate existing data: calculate price from multiplier if price is NULL
        -- This assumes products have price_per_litre
        UPDATE product_variations pv
        SET price = (
            SELECT p.price_per_litre * pv.price_multiplier
            FROM products p
            WHERE p.id = pv.product_id
        )
        WHERE price IS NULL;

        -- Make price NOT NULL after migration (for new records)
        -- We'll keep price_multiplier for backward compatibility but new variations should use price
        ALTER TABLE product_variations
        ALTER COLUMN price SET DEFAULT 0;
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN products.quantity IS 'Current stock quantity';
COMMENT ON COLUMN products.low_stock_threshold IS 'Threshold below which product shows as low stock';
COMMENT ON COLUMN products.category_id IS 'Foreign key to categories table';
COMMENT ON TABLE categories IS 'Product categories for organization';
