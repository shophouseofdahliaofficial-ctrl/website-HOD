-- ============================================
-- Fix users table for Supabase Auth
-- Run this script to update the users table to work with Supabase
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Drop foreign key constraints that reference users.id
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey1;

-- Step 2: Backup existing users table (optional - only if you have data)
-- CREATE TABLE users_backup AS SELECT * FROM users;

-- Step 3: Drop the old users table (WARNING: This deletes all existing users!)
-- Only do this if you're starting fresh or have backed up your data
DROP TABLE IF EXISTS users CASCADE;

-- Step 4: Create new users table with UUID id (matching Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY, -- This will match Supabase auth.users.id
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    -- password_hash removed - Supabase Auth handles authentication
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Step 6: Update subscriptions table to use UUID for user_id
-- First, drop the column if it exists as integer
ALTER TABLE subscriptions DROP COLUMN IF EXISTS user_id;

-- Add user_id as UUID
ALTER TABLE subscriptions ADD COLUMN user_id UUID;

-- Re-add foreign key constraint
ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create index for user_id in subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. This script drops the old users table - make sure you've backed up data if needed
-- 2. After running this, existing subscriptions will need their user_id updated
-- 3. New users created via Supabase Auth will work correctly
-- 4. The id in the users table will match Supabase auth.users.id (UUID)
-- ============================================
