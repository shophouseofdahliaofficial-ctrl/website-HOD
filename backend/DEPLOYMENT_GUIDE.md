# Backend Deployment Guide

This guide explains how to deploy the Milko backend API and get your API URL.

## Deployment Options

You have several options for deploying your backend:

### Option 1: Hetzner (Recommended - You mentioned this earlier)

Since you're using Hetzner for environment variables, you can deploy the backend there.

#### Steps:

1. **Set up a Hetzner server/container:**
   - Create a new server or container in Hetzner
   - Choose Node.js runtime environment
   - Set Node.js version to 18 or 20

2. **Deploy your backend code:**
   - Connect your Git repository
   - Set the root directory to `milko-backend`
   - Set the build command: `npm install`
   - Set the start command: `npm start`

3. **Configure environment variables in Hetzner:**
   - Go to your Hetzner project settings
   - Add all environment variables from `HETZNER_ENV_SETUP.md`
   - Make sure to set:
     - `PORT=3001` (or let Hetzner assign a port)
     - `DATABASE_URL` - Your PostgreSQL connection string
     - `JWT_SECRET` - A strong random secret
     - `FRONTEND_URL=https://milko.in`
     - `ADMIN_URL=https://admin.milko.in`
     - All Cloudinary and Razorpay credentials

4. **Set up PostgreSQL database:**
   - Use Hetzner's managed PostgreSQL service, OR
   - Install PostgreSQL on your server, OR
   - Use an external database service (like Supabase, Neon, or Railway)

5. **Run database migrations:**
   ```bash
   # SSH into your Hetzner server
   cd milko-backend
   # Run migrations manually or add a migration script
   psql $DATABASE_URL -f src/database/migrations/001_initial_schema.sql
   psql $DATABASE_URL -f src/database/migrations/002_add_banners_table.sql
   ```

6. **Get your API URL:**
   - Hetzner will provide you with a URL like: `https://your-app-name.hetzner.app`
   - Or if you set up a custom domain: `https://api.milko.in`
   - Your API will be available at: `https://your-api-url.com/api/...`

### Option 2: Railway (Easy & Fast)

1. **Sign up at [Railway.app](https://railway.app)**
2. **Create a new project**
3. **Add PostgreSQL database** (Railway provides this)
4. **Deploy from GitHub:**
   - Connect your repository
   - Select `milko-backend` as the root directory
   - Railway auto-detects Node.js
5. **Set environment variables** in Railway dashboard
6. **Get your API URL:**
   - Railway provides: `https://your-app-name.up.railway.app`
   - Or use a custom domain: `https://api.milko.in`

### Option 3: Render

1. **Sign up at [Render.com](https://render.com)**
2. **Create a new Web Service**
3. **Connect your GitHub repository**
4. **Configure:**
   - Root Directory: `milko-backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. **Add PostgreSQL database** (Render provides this)
6. **Set environment variables**
7. **Get your API URL:**
   - Render provides: `https://your-app-name.onrender.com`
   - Or use a custom domain: `https://api.milko.in`

### Option 4: DigitalOcean App Platform

1. **Sign up at [DigitalOcean](https://www.digitalocean.com)**
2. **Create a new App**
3. **Connect GitHub repository**
4. **Add PostgreSQL database**
5. **Configure environment variables**
6. **Get your API URL:**
   - DigitalOcean provides: `https://your-app-name.ondigitalocean.app`
   - Or use a custom domain: `https://api.milko.in`

## After Deployment - Getting Your API URL

Once deployed, your API URL will be one of these formats:

- **Hetzner**: `https://your-app-name.hetzner.app` or `https://api.milko.in`
- **Railway**: `https://your-app-name.up.railway.app` or `https://api.milko.in`
- **Render**: `https://your-app-name.onrender.com` or `https://api.milko.in`
- **DigitalOcean**: `https://your-app-name.ondigitalocean.app` or `https://api.milko.in`

### Test Your API

Once deployed, test it:

```bash
# Health check
curl https://your-api-url.com/health

# Should return:
# {"status":"ok","timestamp":"2024-..."}
```

## Setting Up Custom Domain (Optional but Recommended)

For production, set up a custom domain like `api.milko.in`:

1. **Add DNS Record:**
   - Type: `A` or `CNAME`
   - Name: `api` (or `@` for root domain)
   - Value: Your hosting provider's IP or hostname

2. **Configure in Hosting Provider:**
   - Add custom domain in your hosting dashboard
   - SSL certificate will be auto-generated (Let's Encrypt)

3. **Update CORS in Backend:**
   - Make sure `FRONTEND_URL` and `ADMIN_URL` are set correctly
   - The backend already allows `*.milko.in` domains

## Configure Frontend to Use Backend API

Once you have your backend API URL, add it to Vercel:

1. **Go to Vercel Dashboard**
2. **Select your frontend project**
3. **Go to Settings → Environment Variables**
4. **Add:**
   - `NEXT_PUBLIC_API_BASE_URL` = `https://your-api-url.com` (or `https://api.milko.in`)
   - `NEXT_PUBLIC_FRONTEND_URL` = `https://milko.in`
   - `NEXT_PUBLIC_ADMIN_URL` = `https://admin.milko.in`

5. **Redeploy** your frontend

## Quick Start (Recommended: Railway)

If you want the fastest deployment:

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway will detect `milko-backend` folder
5. Add PostgreSQL database in Railway
6. Set environment variables
7. Deploy!
8. Copy the provided URL → That's your `NEXT_PUBLIC_API_BASE_URL`

## Environment Variables Checklist

Make sure these are set in your hosting provider:

**Required:**
- `PORT` (usually auto-set by hosting provider)
- `DATABASE_URL` (from your PostgreSQL provider)
- `JWT_SECRET` (generate a strong random string)
- `FRONTEND_URL=https://milko.in`
- `ADMIN_URL=https://admin.milko.in`

**Cloudinary:**
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

**Razorpay:**
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

## Database Setup

After deploying, you need to run migrations:

1. **Option A: SSH into server and run:**
   ```bash
   psql $DATABASE_URL -f src/database/migrations/001_initial_schema.sql
   psql $DATABASE_URL -f src/database/migrations/002_add_banners_table.sql
   ```

2. **Option B: Use a database migration tool** (recommended for production)

3. **Option C: Use Railway/Render's database console** to run SQL files

## Need Help?

- Check your hosting provider's logs for errors
- Verify all environment variables are set
- Test the `/health` endpoint first
- Make sure database migrations are run
- Check CORS settings if frontend can't connect

