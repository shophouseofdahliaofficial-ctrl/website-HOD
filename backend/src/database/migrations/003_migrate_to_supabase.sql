-- ============================================
-- Migration: Migrate to Supabase Auth
-- This migration updates the users table to work with Supabase Auth
-- ============================================

-- Step 1: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create a new users table structure for Supabase
-- We'll keep the old table temporarily and create a new structure

-- First, let's check if we need to migrate existing data
-- For new Supabase setups, we can drop and recreate
-- For existing data, we'd need a more complex migration

-- Option A: For fresh Supabase setup (recommended for new projects)
-- Drop the old users table constraints and recreate with UUID
DO $$ 
BEGIN
    -- Drop foreign key constraints that reference users.id
    ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
    ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey1;
    
    -- Change users.id from SERIAL to UUID
    -- Note: This will require data migration if you have existing users
    -- For new Supabase projects, it's easier to drop and recreate
    
    -- If you have existing data, you'll need to:
    -- 1. Create a mapping between old integer IDs and new UUIDs
    -- 2. Update all foreign key references
    -- 3. Migrate the data
    
    -- For now, we'll create a new structure assuming fresh start
    -- If you need to preserve data, create a backup first!
END $$;

-- Create new users table structure compatible with Supabase Auth
-- The id will be UUID and will reference auth.users.id
CREATE TABLE IF NOT EXISTS users_new (
    id UUID PRIMARY KEY, -- References auth.users.id from Supabase
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    -- password_hash removed - Supabase Auth handles this
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- If you're starting fresh, you can drop the old table and rename
-- DROP TABLE IF EXISTS users CASCADE;
-- ALTER TABLE users_new RENAME TO users;

-- For existing setups, you'll need to:
-- 1. Migrate data from users to users_new
-- 2. Update subscriptions.user_id to UUID
-- 3. Then drop old table and rename

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users_new(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users_new(role);

-- Update subscriptions table to use UUID for user_id
-- Note: This requires updating existing subscriptions if you have data
ALTER TABLE subscriptions 
    ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;

-- Re-add foreign key constraint
ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users_new(id) ON DELETE CASCADE;

-- For fresh Supabase projects, use this approach:
-- 1. Drop old users table: DROP TABLE IF EXISTS users CASCADE;
-- 2. Rename new table: ALTER TABLE users_new RENAME TO users;
-- 3. Run the rest of your schema

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Supabase Auth creates users in auth.users table automatically
-- 2. Your users table (users_new) stores profile data (name, role)
-- 3. The id in users table should match auth.users.id (UUID)
-- 4. When a user signs up via Supabase Auth, you'll need to create
--    a corresponding row in the users table (see authService.js)
-- 5. For existing projects with data, you'll need a data migration script
-- ============================================

