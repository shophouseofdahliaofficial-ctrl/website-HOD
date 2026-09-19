/**
 * Upload OpenMoji SVG stickers + metadata.json to Cloudinary.
 *
 * Usage (from milko-backend-main/milko-backend-main):
 *   node scripts/uploadOpenMojiToCloudinary.js
 *   node scripts/uploadOpenMojiToCloudinary.js --limit 50
 *   node scripts/uploadOpenMojiToCloudinary.js --metadata-only
 */
const path = require('path');
const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { cloudinary } = require('../src/config/cloudinary');

const OPENMOJI_JSON_URL =
  'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/data/openmoji.json';
const OPENMOJI_SVG_BASE = 'https://cdn.jsdelivr.net/npm/openmoji@15.0.0/color/svg';
const CLOUDINARY_FOLDER = process.env.OPENMOJI_CLOUDINARY_FOLDER || 'openmoji/svg';
const CONCURRENCY = Number(process.env.OPENMOJI_UPLOAD_CONCURRENCY || 4);

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function uploadRemoteSvg(hexcode) {
  const id = hexcode.toUpperCase();
  const sourceUrl = `${OPENMOJI_SVG_BASE}/${id}.svg`;
  return cloudinary.uploader.upload(sourceUrl, {
    folder: CLOUDINARY_FOLDER,
    public_id: id,
    resource_type: 'image',
    overwrite: true,
    unique_filename: false,
    invalidate: true,
  });
}

async function uploadMetadataFile(metadataPath) {
  return cloudinary.uploader.upload(metadataPath, {
    public_id: 'openmoji/metadata',
    resource_type: 'raw',
    overwrite: true,
    unique_filename: false,
    invalidate: true,
  });
}

async function mapWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith('--limit'));
  const limit = limitArg ? Number(limitArg.split('=')[1] || args[args.indexOf('--limit') + 1]) : null;
  const offsetArg = args.find((arg) => arg.startsWith('--offset'));
  const offset = offsetArg ? Number(offsetArg.split('=')[1] || args[args.indexOf('--offset') + 1]) : 0;
  const metadataOnly = args.includes('--metadata-only');

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error('Cloudinary credentials missing from backend .env');
  }

  const frontendMetadataPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'milko-frontend-main (4)',
    'milko-frontend-main',
    'public',
    'openmoji',
    'metadata.json',
  );

  if (!metadataOnly) {
    console.log('[OPENMOJI] Loading upstream catalog...');
    const raw = await fetchJson(OPENMOJI_JSON_URL);
    const entries = raw.filter(
      (entry) => entry.skintone === '' && !entry.openmoji_tags?.includes('component'),
    );
    const targets = (limit ? entries.slice(offset, offset + limit) : entries.slice(offset));
    console.log(
      `[OPENMOJI] Uploading ${targets.length} SVGs to Cloudinary folder "${CLOUDINARY_FOLDER}"` +
        (offset ? ` (offset ${offset})` : '') +
        '...',
    );

    let done = 0;
    let failed = 0;

    await mapWithConcurrency(targets, CONCURRENCY, async (entry) => {
      const id = entry.hexcode.toUpperCase();
      try {
        const result = await uploadRemoteSvg(id);
        done += 1;
        if (done % 25 === 0 || done === targets.length) {
          console.log(`[OPENMOJI] Progress ${done}/${targets.length}`);
        }
        return result.secure_url;
      } catch (error) {
        failed += 1;
        console.error(`[OPENMOJI] Failed ${id}:`, error.message || error);
        return null;
      }
    });

    console.log(`[OPENMOJI] SVG upload complete. ok=${done - failed} failed=${failed}`);
  }

  if (fs.existsSync(frontendMetadataPath)) {
    console.log('[OPENMOJI] Uploading metadata.json...');
    const metadataResult = await uploadMetadataFile(frontendMetadataPath);
    console.log('[OPENMOJI] Metadata URL:', metadataResult.secure_url);
  } else {
    console.warn('[OPENMOJI] metadata.json not found at', frontendMetadataPath);
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  console.log('[OPENMOJI] Asset URL pattern:');
  console.log(`  https://res.cloudinary.com/${cloudName}/image/upload/${CLOUDINARY_FOLDER}/1F600.svg`);
}

main().catch((error) => {
  console.error('[OPENMOJI] Upload failed:', error);
  process.exit(1);
});
