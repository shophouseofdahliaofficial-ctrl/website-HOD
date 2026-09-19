# How to Fix Users Table for Supabase Auth

## The Problem
The `users` table is using the old schema (integer `id` and `password_hash`), but Supabase Auth uses UUID for user IDs and handles authentication separately.

## Quick Fix - Run This SQL in Supabase Dashboard

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `qbjluvlqbaxgsvtyjqid`
3. **Click on "SQL Editor"** in the left sidebar
4. **Click "New Query"**
5. **Copy and paste the following SQL**:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop foreign key constraints
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey1;

-- Drop old users table (WARNING: This deletes all existing users!)
DROP TABLE IF EXISTS users CASCADE;

-- Create new users table with UUID id (matching Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update subscriptions table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS user_id;
        ALTER TABLE subscriptions ADD COLUMN user_id UUID;
        ALTER TABLE subscriptions 
            ADD CONSTRAINT subscriptions_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    END IF;
END $$;
```

6. **Click "Run"** (or press Ctrl+Enter)
7. **You should see "Success. No rows returned"**

## After Running the Migration

1. Try signing up again - it should work now!
2. The `users` table will now accept UUID IDs from Supabase Auth
3. No password_hash column is needed (Supabase handles auth)

## Verify It Worked

Run this query in SQL Editor to check:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
```

You should see:
- `id` as `uuid` (not `integer`)
- No `password_hash` column
- `name`, `email`, `role`, `created_at`, `updated_at`

## Need Help?

If you get errors:
- Make sure you're in the correct Supabase project
- Check that you have permission to modify tables
- If `subscriptions` table doesn't exist yet, that's fine - the script handles it
