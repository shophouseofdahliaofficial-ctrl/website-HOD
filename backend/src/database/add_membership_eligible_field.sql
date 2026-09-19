-- Add is_membership_eligible column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_membership_eligible BOOLEAN NOT NULL DEFAULT false;

-- Create index for membership-eligible products
CREATE INDEX IF NOT EXISTS idx_products_membership_eligible 
ON products(is_membership_eligible) 
WHERE is_membership_eligible = true;
