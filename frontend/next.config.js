/** @type {import('next').NextConfig} */
const { loadEnvConfig } = require('@next/env');

// Load .env / .env.local before reading keys. Without this, this file can run before
// those files are applied and the Maps key stays empty in the client bundle.
loadEnvConfig(__dirname);

// Client-side Maps reads NEXT_PUBLIC_*; we also accept GOOGLE_MAPS_API_KEY here and map it through.
// Use either name in .env.local next to package.json, then restart the dev server (Ctrl+C, then npm run dev).
const googleMapsApiKey = String(
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
)
  .trim()
  .replace(/^['"]|['"]$/g, '');

const nextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: googleMapsApiKey,
  },

  reactStrictMode: true,

  // Avoid stale admin UI after deploy (browser / CDN keeping old HTML or JS chunks)
  async headers() {
    const adminNoStore = [{ key: 'Cache-Control', value: 'private, no-store, must-revalidate' }];
    const noIndexHeaders = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }];
    const adminHeaders = [...adminNoStore, ...noIndexHeaders];

    return [
      { source: '/admin', headers: adminHeaders },
      { source: '/admin/:path*', headers: adminHeaders },
      { source: '/auth', headers: noIndexHeaders },
      { source: '/auth/:path*', headers: noIndexHeaders },
      { source: '/account', headers: noIndexHeaders },
      { source: '/dashboard', headers: noIndexHeaders },
      { source: '/orders', headers: noIndexHeaders },
      { source: '/orders/:path*', headers: noIndexHeaders },
      { source: '/subscriptions', headers: noIndexHeaders },
      { source: '/subscriptions/:path*', headers: noIndexHeaders },
      { source: '/cart', headers: noIndexHeaders },
      { source: '/checkout', headers: noIndexHeaders },
      { source: '/coming-soon', headers: noIndexHeaders },
      { source: '/order-success', headers: noIndexHeaders },
      { source: '/reviews', headers: noIndexHeaders },
      { source: '/search', headers: noIndexHeaders },
      { source: '/subscribe', headers: noIndexHeaders },
    ];
  },

  // Image optimization for Cloudinary
  images: {
    domains: ['res.cloudinary.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // Suppress build warnings
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig

