# Quick Setup - Add Your Supabase Credentials

## Step 1: Create .env File

1. Go to `milko-backend` folder
2. Create a new file named `.env` (with the dot at the beginning)
3. Copy and paste this content into the file:

```bash
# ============================================
# Supabase Configuration
# ============================================
SUPABASE_URL="https://qbjluvlqbaxgsvtyjqid.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiamx1dmxxYmF4Z3N2dHlqcWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDE4ODcsImV4cCI6MjA4MzI3Nzg4N30.TYFFmAWI0p4dJFoP0NygcHyrQJ4kopyULh1R8Xhw5VQ"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiamx1dmxxYmF4Z3N2dHlqcWlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwMTg4NywiZXhwIjoyMDgzMjc3ODg3fQ.nYLW5G8dRnIL-pxHvrQNvlHp5gOL7uw30S85sU8lTIE"
SUPABASE_DB_URL=""

# ============================================
# JWT Configuration
# ============================================
JWT_SECRET="milko-jwt-secret-change-in-production"
JWT_EXPIRES_IN="7d"

# ============================================
# Application URLs
# ============================================
FRONTEND_URL="http://localhost:3000"
ADMIN_URL="http://localhost:3000"

# ============================================
# Payment Configuration (Razorpay) - Optional
# ============================================
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""

# ============================================
# Image Upload Configuration (Cloudinary) - Optional
# ============================================
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

## Step 2: Get Database Connection String

You still need to add the `SUPABASE_DB_URL`. Here's how:

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/qbjluvlqbaxgsvtyjqid
2. Click **Settings** (gear icon) in the left sidebar
3. Click **Database** in the settings menu
4. Scroll down to **"Connection string"** section
5. Click on the **"URI"** tab
6. You'll see a connection string like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
7. **Important**: Replace `[YOUR-PASSWORD]` with the database password you set when creating the project
8. Copy the complete connection string
9. Paste it in your `.env` file as the value for `SUPABASE_DB_URL`

**Example:**
```bash
SUPABASE_DB_URL="postgresql://postgres.qbjluvlqbaxgsvtyjqid:YOUR_PASSWORD_HERE@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
```

Replace `YOUR_PASSWORD_HERE` with your actual database password.

## Step 3: Save the File

Save the `.env` file after adding the database connection string.

