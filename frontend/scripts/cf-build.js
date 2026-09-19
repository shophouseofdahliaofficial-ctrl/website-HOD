const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('==> Running Cloudflare next-on-pages build...');
execSync('npx @cloudflare/next-on-pages', { stdio: 'inherit' });

const staticDir = path.join(__dirname, '..', '.vercel', 'output', 'static');
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
}

const assetsIgnorePath = path.join(staticDir, '.assetsignore');
fs.writeFileSync(assetsIgnorePath, '_worker.js\n', 'utf8');
console.log(`==> Created ${assetsIgnorePath} containing _worker.js`);
