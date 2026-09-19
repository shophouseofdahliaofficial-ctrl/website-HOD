-- ============================================
-- ADDRESSES TABLE
-- Stores user delivery addresses
-- Run in Supabase SQL Editor or via psql
-- Requires: users table with id UUID (Supabase)
-- ============================================

-- Trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- Address label (e.g., "Home", "Office")
    street VARCHAR(500) NOT NULL,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    phone VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for user addresses lookup
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- Index for default address lookup
CREATE INDEX IF NOT EXISTS idx_addresses_default ON addresses(user_id, is_default) WHERE is_default = true;

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses;
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE addresses IS 'Stores user delivery addresses';
COMMENT ON COLUMN addresses.name IS 'Address label/name (e.g., "Home", "Office", "Work")';
COMMENT ON COLUMN addresses.is_default IS 'Whether this is the default address for the user';
