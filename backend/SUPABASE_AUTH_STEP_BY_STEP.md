# Supabase Authentication Setup - Step by Step Guide

Follow these steps one by one to set up authentication in your Milko app with Supabase.

---

## Step 1: Create a Supabase Account and Project

### 1.1 Sign Up for Supabase
1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"Sign Up"**
3. Sign up with:
   - GitHub (recommended)
   - Google
   - Email

### 1.2 Create a New Project
1. Once logged in, click **"New Project"** (green button)
2. Fill in the form:
   - **Name**: `milko` (or any name you prefer)
   - **Database Password**: 
     - Create a strong password
     - ⚠️ **SAVE THIS PASSWORD** - you'll need it later!
     - Example: `MySecurePassword123!`
   - **Region**: Choose the closest region to your users
     - For India: Choose a region in Asia (e.g., `Southeast Asia (Singapore)`)
   - **Pricing Plan**: Select **"Free"** (good for development)
3. Click **"Create new project"**
4. ⏳ Wait 2-3 minutes for the project to be created

---

## Step 2: Get Your Supabase Credentials

Once your project is ready, you need to get 4 important values:

### 2.1 Get Project URL and API Keys
1. In your Supabase dashboard, click **"Settings"** (gear icon in left sidebar)
2. Click **"API"** in the settings menu
3. You'll see a page with your API credentials

**Copy these values:**

#### a) Project URL (`SUPABASE_URL`)
- Look for **"Project URL"** section
- Copy the URL (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
- Example: `https://abcdefghijklmnop.supabase.co`
- ✅ **Save this** - you'll need it for `SUPABASE_URL`

#### b) Anon/Public Key (`SUPABASE_ANON_KEY`)
- Scroll down to **"Project API keys"** section
- Find the key labeled **"anon"** `public`
- Click the **eye icon** to reveal it, then click **copy icon**
- It's a long string starting with `eyJ...`
- ✅ **Save this** - you'll need it for `SUPABASE_ANON_KEY`

#### c) Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)
- In the same **"Project API keys"** section
- Find the key labeled **"service_role"** `secret`
- Click the **eye icon** to reveal it, then click **copy icon**
- ⚠️ **KEEP THIS SECRET!** Never share this or use it in frontend code
- ✅ **Save this** - you'll need it for `SUPABASE_SERVICE_ROLE_KEY`

### 2.2 Get Database Connection String
1. Still in Settings, click **"Database"** in the left menu
2. Scroll down to **"Connection string"** section
3. Click on the tab **"URI"**
4. You'll see a connection string like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
5. **Important**: Replace `[YOUR-PASSWORD]` with the database password you created in Step 1.2
6. Copy the complete connection string
7. ✅ **Save this** - you'll need it for `SUPABASE_DB_URL`

**Example of what it should look like:**
```
postgresql://postgres.abcdefghijklmnop:MySecurePassword123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

---

## Step 3: Update Your Backend Environment Variables

### 3.1 Navigate to Backend Directory
1. Open your project in your code editor
2. Navigate to `milko-backend` folder

### 3.2 Create or Update .env File
1. In `milko-backend` folder, check if `.env` file exists
2. If it doesn't exist, create a new file named `.env`
3. Open the `.env` file

### 3.3 Add Supabase Credentials
Add these lines to your `.env` file (replace with your actual values):

```bash
# ============================================
# Supabase Configuration
# ============================================
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
SUPABASE_DB_URL="postgresql://postgres.your-project:your-password@aws-0-region.pooler.supabase.com:6543/postgres"

# ============================================
# Other Configuration (keep existing values)
# ============================================
JWT_SECRET="your-random-secret-string-here"
FRONTEND_URL="http://localhost:3000"
ADMIN_URL="http://localhost:3000"
```

**Replace:**
- `https://your-project-id.supabase.co` → Your actual Project URL from Step 2.1a
- `your-anon-key-here` → Your anon key from Step 2.1b
- `your-service-role-key-here` → Your service role key from Step 2.1c
- `postgresql://...` → Your complete database connection string from Step 2.2

**Example:**
```bash
SUPABASE_URL="https://abcdefghijklmnop.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.abcdefghijklmnopqrstuvwxyz1234567890"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.abcdefghijklmnopqrstuvwxyz1234567890"
SUPABASE_DB_URL="postgresql://postgres.abcdefghijklmnop:MySecurePassword123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
```

4. **Save the file**

---

## Step 4: Update Database Schema for Supabase

Supabase uses UUIDs for user IDs, so we need to update your database schema.

### 4.1 Connect to Your Supabase Database
You have two options:

#### Option A: Using Supabase SQL Editor (Easiest)
1. Go to your Supabase dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**

#### Option B: Using Command Line
1. Open terminal/command prompt
2. Make sure you have `psql` installed
3. Use the connection string from Step 2.2

### 4.2 Run the Migration Script

#### If using SQL Editor (Option A):
1. Copy the contents of `milko-backend/src/database/migrations/003_migrate_to_supabase.sql`
2. Paste it into the SQL Editor
3. Click **"Run"** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

#### If using Command Line (Option B):
```bash
cd milko-backend
psql "your-SUPABASE_DB_URL-here" -f src/database/migrations/003_migrate_to_supabase.sql
```

### 4.3 Create Users Table (If Starting Fresh)

If you're starting fresh, run this SQL in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table compatible with Supabase Auth
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,  -- This will match Supabase auth.users.id
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update subscriptions table to use UUID (if it exists)
-- If subscriptions table doesn't exist yet, skip this
ALTER TABLE subscriptions 
    ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;

ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

---

## Step 5: Configure Supabase Auth Settings

### 5.1 Configure Email Authentication
1. In Supabase dashboard, click **"Authentication"** in left sidebar
2. Click **"Settings"** (gear icon)
3. Scroll to **"Auth Providers"** section
4. Make sure **"Email"** is enabled
5. For **development**, you can disable email confirmation:
   - Scroll to **"Email Auth"** settings
   - Toggle **"Confirm email"** to OFF (for easier testing)
   - ⚠️ **Turn this ON for production!**

### 5.2 Configure Site URLs
1. Still in Authentication → Settings
2. Scroll to **"URL Configuration"**
3. Set **"Site URL"**: `http://localhost:3000`
4. Add **"Redirect URLs"**:
   - `http://localhost:3000/**`
   - `http://localhost:3000/auth/**`
   - (Add your production URLs when deploying)

---

## Step 6: Test the Backend Connection

### 6.1 Start the Backend Server
1. Open terminal
2. Navigate to backend directory:
   ```bash
   cd milko-backend
   ```
3. Install dependencies (if not done):
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### 6.2 Check for Connection
You should see:
- ✅ `Database connected` message
- ✅ Server running on port (usually 5000)
- ❌ No Supabase connection errors

If you see errors, check:
- Environment variables are set correctly
- No typos in `.env` file
- Supabase project is active

---

## Step 7: Test Authentication Endpoints

### 7.1 Test User Signup
Open a new terminal and run:

```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"test123456\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Test User",
      "email": "test@example.com",
      "role": "customer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully"
}
```

### 7.2 Test User Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"test123456\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Test User",
      "email": "test@example.com",
      "role": "customer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

### 7.3 Test Protected Route (Get Current User)
Use the token from login response:

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Replace `YOUR_TOKEN_HERE` with the token from Step 7.2

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Test User",
      "email": "test@example.com",
      "role": "customer"
    }
  }
}
```

---

## Step 8: Verify in Supabase Dashboard

### 8.1 Check Authentication Users
1. Go to Supabase dashboard
2. Click **"Authentication"** → **"Users"**
3. You should see the user you just created (`test@example.com`)

### 8.2 Check Database Users Table
1. Go to **"Table Editor"** in Supabase dashboard
2. Click on **"users"** table
3. You should see a row with:
   - `id`: UUID matching the auth user
   - `name`: "Test User"
   - `email`: "test@example.com"
   - `role`: "customer"

---

## Step 9: Create an Admin User (Optional)

If you need an admin user:

### 9.1 Create Admin via API
1. First, sign up a user (Step 7.1)
2. Note the user's `id` (UUID) from the response
3. Go to Supabase SQL Editor
4. Run this SQL (replace with actual UUID):

```sql
UPDATE users 
SET role = 'admin' 
WHERE id = 'your-user-uuid-here';
```

### 9.2 Or Create Admin Directly in Database
1. Sign up a user via API
2. Go to Supabase **Table Editor** → **users**
3. Find the user row
4. Click to edit
5. Change `role` from `customer` to `admin`
6. Save

---

## ✅ You're Done!

Your authentication is now set up with Supabase! 

### What's Working:
- ✅ User signup creates account in Supabase Auth
- ✅ User login authenticates with Supabase
- ✅ JWT tokens are verified by Supabase
- ✅ User profiles are stored in your database
- ✅ Protected routes work with Supabase tokens

### Next Steps:
1. Test authentication from your frontend
2. Update frontend to use the Supabase tokens
3. Test all authentication flows
4. Set up production environment when ready

---

## Troubleshooting

### Problem: "Invalid API key"
- ✅ Check `SUPABASE_ANON_KEY` in `.env` file
- ✅ Make sure no extra spaces or quotes
- ✅ Copy the key again from Supabase dashboard

### Problem: "Database connection failed"
- ✅ Verify `SUPABASE_DB_URL` is correct
- ✅ Check password in connection string
- ✅ Make sure database is active in Supabase

### Problem: "User not found" after signup
- ✅ Check if user exists in Supabase Auth → Users
- ✅ Check if profile was created in users table
- ✅ Verify database migration ran successfully

### Problem: "Email already registered"
- ✅ User might exist in Supabase Auth
- ✅ Check Authentication → Users in dashboard
- ✅ Delete test user and try again

---

## Need Help?

- Check `SUPABASE_SETUP.md` for more details
- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com

