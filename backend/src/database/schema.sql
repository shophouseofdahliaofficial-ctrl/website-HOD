-- ============================================
-- Milko.in Database Schema
-- PostgreSQL Database Schema
-- ============================================

-- Enable UUID extension (if using UUIDs for IDs)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- Stores all users (customers and admins)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- PRODUCTS TABLE
-- Stores milk products (Cow Milk, Buffalo Milk, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_per_litre DECIMAL(10, 2) NOT NULL CHECK (price_per_litre >= 0),
    image_url VARCHAR(500),
    quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    category_id INTEGER,
    selling_price DECIMAL(10, 2),
    compare_at_price DECIMAL(10, 2),
    tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0 CHECK (tax_percent >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for active products (customer view)
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active) WHERE is_active = true;

-- Index for selling_price queries
CREATE INDEX IF NOT EXISTS idx_products_selling_price ON products(selling_price);

-- Ensure newer product columns exist when upgrading an existing DB created from an older schema.sql
ALTER TABLE products
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS category_id INTEGER,
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5, 2) DEFAULT 0;

-- Categories (used by admin UI)
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

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- ============================================
-- PRODUCT IMAGES TABLE
-- Stores multiple images per product
-- ============================================
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_display_order ON product_images(product_id, display_order);

-- ============================================
-- PRODUCT VARIATIONS TABLE
-- Stores available sizes/variations for each product
-- ============================================
CREATE TABLE IF NOT EXISTS product_variations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size VARCHAR(50) NOT NULL,
    price_multiplier DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    price DECIMAL(10, 2),
    compare_at_price DECIMAL(10, 2),
    is_available BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, size)
);

CREATE INDEX IF NOT EXISTS idx_product_variations_product_id ON product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_available ON product_variations(product_id, is_available) WHERE is_available = true;

-- ============================================
-- PRODUCT REVIEWS TABLE
-- Stores customer reviews for products
-- ============================================
CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewer_name VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved ON product_reviews(product_id, is_approved) WHERE is_approved = true;
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id) WHERE user_id IS NOT NULL;

-- ============================================
-- SUBSCRIPTIONS TABLE
-- Stores customer subscriptions for daily milk delivery
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    litres_per_day DECIMAL(5, 2) NOT NULL CHECK (litres_per_day > 0),
    duration_months INTEGER NOT NULL CHECK (duration_months > 0),
    delivery_time TIME NOT NULL, -- e.g., '08:00:00'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'expired', 'failed')),
    razorpay_subscription_id VARCHAR(255), -- Razorpay subscription/order ID
    razorpay_payment_id VARCHAR(255), -- Razorpay payment ID
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_dates CHECK (end_date >= start_date)
);

-- Index for user subscriptions lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Index for product subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_product_id ON subscriptions(product_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(start_date, end_date);

-- Index for Razorpay ID lookups (webhook processing)
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_id ON subscriptions(razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;

-- AutoPay setup failure (mirrors ensureSubscriptionSchema in app)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS autopay_failure_reason TEXT;

-- ============================================
-- DELIVERY SCHEDULES TABLE
-- Stores daily delivery schedule entries
-- Generated automatically when subscription is activated
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_schedules (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    delivery_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'skipped', 'cancelled')),
    delivered_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Ensure one delivery per subscription per date
    UNIQUE(subscription_id, delivery_date)
);

-- Index for date-based queries (admin delivery view)
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_date ON delivery_schedules(delivery_date);

-- Index for subscription deliveries
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_subscription ON delivery_schedules(subscription_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_status ON delivery_schedules(status);

-- Composite index for common query: date + status
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_date_status ON delivery_schedules(delivery_date, status);

-- ============================================
-- PAUSED DATES TABLE
-- Stores dates when customer has paused delivery
-- These dates are automatically skipped in delivery schedule generation
-- ============================================
CREATE TABLE IF NOT EXISTS paused_dates (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Ensure one pause entry per subscription per date
    UNIQUE(subscription_id, date)
);

-- Index for subscription paused dates
CREATE INDEX IF NOT EXISTS idx_paused_dates_subscription ON paused_dates(subscription_id);

-- Index for date lookups
CREATE INDEX IF NOT EXISTS idx_paused_dates_date ON paused_dates(date);

-- ============================================
-- PAYMENTS TABLE
-- Stores payment records (for tracking and history)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    razorpay_payment_id VARCHAR(255) UNIQUE NOT NULL,
    razorpay_order_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    paid_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for subscription payments
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);

-- Index for Razorpay payment ID (webhook lookups)
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_id ON payments(razorpay_payment_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ============================================
-- FUNCTION: Update updated_at timestamp
-- Automatically updates updated_at column on row update
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_schedules_updated_at BEFORE UPDATE ON delivery_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to product detail tables
CREATE TRIGGER update_product_images_updated_at BEFORE UPDATE ON product_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variations_updated_at BEFORE UPDATE ON product_variations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON product_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS (Documentation)
-- ============================================
COMMENT ON TABLE users IS 'Stores all users (customers and admins)';
COMMENT ON TABLE products IS 'Stores milk products available for subscription';
COMMENT ON TABLE subscriptions IS 'Stores customer subscriptions for daily milk delivery';
COMMENT ON TABLE delivery_schedules IS 'Stores daily delivery schedule entries, generated when subscription is activated';
COMMENT ON TABLE paused_dates IS 'Stores dates when customer has paused delivery for a subscription';
COMMENT ON TABLE payments IS 'Stores payment records linked to subscriptions';

COMMENT ON COLUMN subscriptions.delivery_time IS 'Time of day for delivery (e.g., 08:00:00)';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status: pending (payment pending), active, paused, cancelled, expired, failed';
COMMENT ON COLUMN delivery_schedules.status IS 'Delivery status: pending, delivered, skipped, cancelled';

