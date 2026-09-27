const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('==> Running Cloudflare next-on-pages build...');
execSync('npx @cloudflare/next-on-pages', { stdio: 'inherit' });

// Ensure any stale .assetsignore excluding _worker.js is removed
const staticDir = path.join(__dirname, '..', '.vercel', 'output', 'static');
const assetsIgnorePath = path.join(staticDir, '.assetsignore');
if (fs.existsSync(assetsIgnorePath)) {
  fs.unlinkSync(assetsIgnorePath);
  console.log(`==> Removed stale ${assetsIgnorePath}`);
}
