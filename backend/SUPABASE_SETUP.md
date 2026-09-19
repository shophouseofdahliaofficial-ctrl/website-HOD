# Supabase Setup Guide for Milko Backend

This guide will help you connect your Milko backend to Supabase for authentication and database.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. A Supabase project created

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: `milko` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine to start
4. Click "Create new project"
5. Wait 2-3 minutes for the project to be set up

---

## Step 2: Get Your Supabase Credentials

Once your project is ready:

1. Go to **Settings** → **API** in your Supabase dashboard
2. You'll need these values:

### Required Credentials:

- **Project URL** (`SUPABASE_URL`)
  - Found under "Project URL"
  - Example: `https://xxxxxxxxxxxxx.supabase.co`

- **Anon/Public Key** (`SUPABASE_ANON_KEY`)
  - Found under "Project API keys" → "anon" `public`
  - This is safe to use in client-side code

- **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`) - Optional but recommended
  - Found under "Project API keys" → "service_role" `secret`
  - ⚠️ **KEEP THIS SECRET!** Never expose this in client-side code
  - Used for admin operations on the backend

- **Database Connection String** (`SUPABASE_DB_URL`)
  - Go to **Settings** → **Database**
  - Under "Connection string" → "URI"
  - Copy the connection string
  - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres`
  - Replace `[YOUR-PASSWORD]` with your database password

---

## Step 3: Update Your Backend Environment Variables

1. Navigate to `milko-backend/` directory
2. Create or update `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"  # Optional but recommended
SUPABASE_DB_URL="postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"

# Legacy support (optional - can use SUPABASE_DB_URL instead)
# DATABASE_URL="postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"

# Other environment variables (keep existing ones)
JWT_SECRET="your-jwt-secret-here"  # Still used for some operations, but Supabase handles auth tokens
FRONTEND_URL="http://localhost:3000"
ADMIN_URL="http://localhost:3000"

# Payment and image upload (if using)
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

---

## Step 4: Update Database Schema for Supabase

Supabase uses UUIDs for user IDs instead of integers. You need to update your database schema.

### Option A: Fresh Setup (Recommended for new projects)

If you're starting fresh or can recreate your database:

1. Run the migration script:

```bash
cd milko-backend
psql $SUPABASE_DB_URL -f src/database/migrations/003_migrate_to_supabase.sql
```

2. Or manually update the schema:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop old users table (if exists and you're okay losing data)
DROP TABLE IF EXISTS users CASCADE;

-- Create new users table with UUID
CREATE TABLE users (
    id UUID PRIMARY KEY,  -- This will reference Supabase auth.users.id
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Update subscriptions table to use UUID
ALTER TABLE subscriptions 
    ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;

-- Re-add foreign key
ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

### Option B: Migrate Existing Data

If you have existing user data, you'll need a more complex migration:

1. Export your existing users data
2. Create a mapping between old integer IDs and new UUIDs
3. Update all foreign key references
4. Import the data with new UUIDs

**Note**: For production databases with existing data, consider creating a migration script that:
- Creates new UUIDs for each user
- Updates all related tables (subscriptions, etc.)
- Preserves data integrity

---

## Step 5: Configure Supabase Auth Settings

1. Go to **Authentication** → **Settings** in Supabase dashboard
2. Configure these settings:

### Email Auth Settings:
- ✅ Enable "Enable email signup"
- ✅ Enable "Confirm email" (recommended for production)
- For development, you can disable email confirmation temporarily

### JWT Settings:
- JWT expiry: Default (3600 seconds) is fine
- You can adjust this if needed

### URL Configuration:
- **Site URL**: Your frontend URL (e.g., `http://localhost:3000`)
- **Redirect URLs**: Add your frontend URLs where users should be redirected after auth

---

## Step 6: Set Up Database Tables in Supabase

1. Go to **SQL Editor** in Supabase dashboard
2. Run your schema file:

```sql
-- Copy and paste the contents of src/database/schema.sql
-- But make sure users table uses UUID (see Step 4)
```

Or use the Supabase migration:

```bash
# Using Supabase CLI (if installed)
supabase db push

# Or manually via SQL Editor in dashboard
```

---

## Step 7: Test the Connection

1. Start your backend:

```bash
cd milko-backend
npm install  # Make sure @supabase/supabase-js is installed
npm run dev
```

2. You should see:
   - ✅ Database connected
   - No Supabase connection errors

3. Test authentication:

```bash
# Test signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123456"
  }'

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

---

## Step 8: Create an Admin User (Optional)

To create an admin user, you can:

1. **Via Supabase Dashboard**:
   - Go to **Authentication** → **Users**
   - Create a new user manually
   - Note the user's UUID

2. **Update the user's role in database**:
   ```sql
   UPDATE users SET role = 'admin' WHERE id = 'user-uuid-here';
   ```

3. **Or use Supabase SQL Editor**:
   ```sql
   -- First, sign up via API to create auth user
   -- Then update role:
   UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
   ```

---

## Troubleshooting

### Issue: "Invalid API key"
- ✅ Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- ✅ Make sure there are no extra spaces or quotes

### Issue: "Database connection failed"
- ✅ Verify `SUPABASE_DB_URL` is correct
- ✅ Check that your IP is allowed (Supabase allows all IPs by default on free tier)
- ✅ Verify database password is correct

### Issue: "User not found" after signup
- ✅ Check that user profile is being created in `users` table
- ✅ Verify the migration ran successfully
- ✅ Check that `id` in users table matches `auth.users.id` (UUID)

### Issue: "Email already registered"
- ✅ User might exist in Supabase Auth but not in your `users` table
- ✅ Check Supabase **Authentication** → **Users** dashboard
- ✅ You may need to create the profile manually or fix the signup flow

### Issue: Token verification fails
- ✅ Make sure you're using the token from Supabase (not a custom JWT)
- ✅ Check that `SUPABASE_ANON_KEY` is correct
- ✅ Verify token hasn't expired

---

## Important Notes

1. **User IDs are now UUIDs**: All user IDs from Supabase Auth are UUIDs, not integers. Make sure your frontend and database schema handle this.

2. **Password Management**: 
   - Passwords are now handled by Supabase Auth
   - You cannot directly query or update passwords
   - Use Supabase Auth API for password changes

3. **Email Confirmation**: 
   - If email confirmation is enabled, users need to verify their email before they can log in
   - For development, you can disable this in Supabase settings

4. **Session Tokens**: 
   - Supabase returns JWT tokens in the session
   - These tokens are different from custom JWTs
   - The middleware now verifies Supabase tokens

5. **Database Access**: 
   - You can access your Supabase database via:
     - SQL Editor in dashboard
     - Connection string (for migrations, etc.)
     - Supabase client libraries

---

## Next Steps

1. ✅ Update frontend to use Supabase tokens
2. ✅ Test all authentication flows
3. ✅ Update any hardcoded user ID references
4. ✅ Set up Row Level Security (RLS) policies in Supabase if needed
5. ✅ Configure production environment variables

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

---

## Support

If you encounter issues:
1. Check Supabase dashboard logs: **Logs** → **API** or **Database**
2. Check backend console for error messages
3. Verify all environment variables are set correctly
4. Check Supabase status page: [status.supabase.com](https://status.supabase.com)

