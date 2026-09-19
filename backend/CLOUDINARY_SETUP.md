# Cloudinary Setup for Milko

Cloudinary is used for uploading product images and banners.

## Step 1: Create Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Verify your email

## Step 2: Get Your Cloudinary Credentials

1. Once logged in, go to your **Dashboard**
2. You'll see your credentials:
   - **Cloud Name** (e.g., `your-cloud-name`)
   - **API Key** (e.g., `123456789012345`)
   - **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

## Step 3: Add to Backend .env File

Add these to your `milko-backend/.env` file:

```bash
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

## Step 4: Restart Backend Server

After adding the credentials, restart your backend server:

```bash
cd milko-backend
npm run dev
```

## How It Works

- **Product Images**: Uploaded to `milko/products/` folder in Cloudinary
- **Banners**: Uploaded to `milko/banners/` folder in Cloudinary
- Images are automatically optimized and served via CDN
- Old images are deleted from Cloudinary when products/banners are updated or deleted

## Testing

1. Try uploading a product image in the admin panel
2. Try uploading a banner
3. Check your Cloudinary dashboard to see the uploaded images

## Notes

- Free tier includes 25GB storage and 25GB bandwidth per month
- Images are automatically optimized for web
- CDN delivery ensures fast loading times worldwide

