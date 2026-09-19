# Backend env setup (copy/paste)

Create a file `milko-backend/.env` with:

```bash
# ============================================
# Supabase Configuration (Required)
# ============================================
SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"  # Optional but recommended
SUPABASE_DB_URL="postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"

# Legacy database URL (optional - can use SUPABASE_DB_URL instead)
# DATABASE_URL="postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"

# ============================================
# JWT Configuration (Optional - Supabase handles auth tokens)
# ============================================
JWT_SECRET="replace-with-any-random-string"  # Still used for some operations
JWT_EXPIRES_IN="7d"

# ============================================
# Application URLs
# ============================================
FRONTEND_URL="https://www.myscribble.in"
ADMIN_URL="https://www.myscribble.in"

# Optional extra CORS origins (comma-separated). www/non-www variants of FRONTEND_URL are added automatically.
# CORS_ALLOWED_ORIGINS="https://myscribble.in,https://admin.myscribble.in"

# ============================================
# Admin panel / coming-soon bypass password
# NOT the Supabase database password — set this separately.
# Default if unset: 2316
# ============================================
ADMIN_PANEL_PASSWORD="2316"

# ============================================
# Payment Configuration (Razorpay)
# ============================================
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""

# ============================================
# Image Upload Configuration (Cloudinary)
# ============================================
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# ============================================
# SMTP Configuration (For email notifications)
# ============================================
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_SECURE="false"
CONTACT_EMAIL="contact@myscribble.in"
```

## Getting Supabase Credentials

1. Go to your Supabase project dashboard
2. **Settings** → **API**:
   - Copy `Project URL` → `SUPABASE_URL`
   - Copy `anon` `public` key → `SUPABASE_ANON_KEY`
   - Copy `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)
3. **Settings** → **Database**:
   - Copy connection string (URI) → `SUPABASE_DB_URL`
   - Replace `[YOUR-PASSWORD]` with your database password

See `SUPABASE_SETUP.md` for detailed setup instructions.


