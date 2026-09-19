# Troubleshooting Database Connection Issues

## Current Issue: Database Connection Timeout

The database connection is timing out when trying to connect to Supabase on port 5432.

## Critical Steps (Do These First!)

### 1. Run the SQL Migration in Supabase Dashboard ⚠️ REQUIRED

**This is the most important step!** Even if the app can't connect, you can run SQL directly in Supabase:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"**
5. Copy and paste this SQL:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop foreign key constraints (if they exist)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey1;

-- Drop old users table
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

6. Click **"Run"** (or press Ctrl+Enter)
7. You should see: **"Success. No rows returned"**

**After this, signup and login should work!**

---

## Fixing Connection Timeout Issues

### Option 1: Check Your Network/Firewall

The connection timeout might be due to:
- Firewall blocking port 5432
- VPN interfering with connection
- Network restrictions

**Try:**
1. Disable VPN if you're using one
2. Check Windows Firewall settings
3. Try from a different network (mobile hotspot)

### Option 2: Verify Database URL Format

Your `.env` file should have:
```env
SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.qbjluvlqbaxgsvtyjqid.supabase.co:5432/postgres"
```

**Important:** If your password contains special characters like `@`, they need to be URL-encoded:
- `@` becomes `%40`
- Your password `Gopal1234@9-0` should be `Gopal1234%409-0` in the URL

### Option 3: Check Supabase Database Status

1. Go to Supabase Dashboard
2. Check if your database is paused (free tier databases pause after inactivity)
3. If paused, click "Resume" to wake it up
4. Wait 1-2 minutes for it to fully start

### Option 4: Use Supabase Connection Pooler (If Available)

Some Supabase projects have connection pooling enabled:

1. Go to Supabase Dashboard → Settings → Database
2. Look for "Connection Pooling" section
3. If available, use the pooler connection string (port 6543)
4. Update `SUPABASE_DB_URL` in `.env` with the pooler URL

### Option 5: Test Connection Manually

Run this command to test the connection:
```bash
cd milko-backend
npm run db:test-connection
```

This will show you exactly where the connection is failing.

---

## After Running Migration

Once you've run the SQL migration in Supabase Dashboard:

1. **Restart your backend server:**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   cd milko-backend
   npm run dev
   ```

2. **Try signing up again** - it should work now!

3. **Check the backend console** for any remaining errors

---

## Still Having Issues?

If connection still times out after trying all options:

1. **Check Supabase Dashboard** - Is the database active?
2. **Check your internet connection** - Can you access other websites?
3. **Try from a different network** - Mobile hotspot, different WiFi
4. **Check Supabase status page** - https://status.supabase.com

The migration SQL **must be run in Supabase Dashboard** regardless of connection issues - that's the critical step!
