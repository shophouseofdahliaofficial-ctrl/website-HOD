const https = require('https');

function getBunnyConfig() {
  const zone = process.env.BUNNY_STORAGE_ZONE || '';
  const apiKey = process.env.BUNNY_STORAGE_API_KEY || '';
  const accountApiKey = process.env.BUNNY_API_KEY || '';
  const hostname = String(process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const cdnBase = (process.env.BUNNY_CDN_BASE_URL || '').replace(/\/$/, '');
  return { zone, apiKey, accountApiKey, hostname, cdnBase };
}

function isBunnyConfigured() {
  const { zone, apiKey, cdnBase } = getBunnyConfig();
  return Boolean(zone && apiKey && cdnBase);
}

function isBunnyPurgeConfigured() {
  const { accountApiKey } = getBunnyConfig();
  return Boolean(accountApiKey);
}

function buildPublicUrl(relativePath) {
  const { cdnBase } = getBunnyConfig();
  const clean = String(relativePath || '').replace(/^\/+/, '');
  return `${cdnBase}/${clean}`;
}

/**
 * Upload a buffer to Bunny Storage.
 * @param {string} relativePath - Path inside the storage zone (no leading slash)
 * @param {Buffer} buffer
 * @param {string} contentType
 */
function uploadBuffer(relativePath, buffer, contentType = 'application/octet-stream') {
  const { zone, apiKey, hostname } = getBunnyConfig();
  if (!zone || !apiKey) {
    throw new Error('Bunny Storage is not configured (BUNNY_STORAGE_ZONE / BUNNY_STORAGE_API_KEY)');
  }

  const cleanPath = String(relativePath || '').replace(/^\/+/, '');
  const options = {
    hostname,
    port: 443,
    method: 'PUT',
    path: `/${zone}/${cleanPath}`,
    headers: {
      AccessKey: apiKey,
      'Content-Type': contentType,
      'Content-Length': buffer.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            path: cleanPath,
            url: buildPublicUrl(cleanPath),
            statusCode: res.statusCode,
          });
        } else {
          reject(new Error(`Bunny upload failed (${res.statusCode}): ${body || 'unknown error'}`));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

/**
 * Check if a file exists in Bunny Storage (HEAD).
 */
function fileExists(relativePath) {
  const { zone, apiKey, hostname } = getBunnyConfig();
  const cleanPath = String(relativePath || '').replace(/^\/+/, '');
  const options = {
    hostname,
    port: 443,
    method: 'HEAD',
    path: `/${zone}/${cleanPath}`,
    headers: { AccessKey: apiKey },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

/**
 * Upload only if the path does not already exist (prevents duplicate uploads).
 */
async function uploadBufferIfMissing(relativePath, buffer, contentType) {
  const exists = await fileExists(relativePath);
  if (exists) {
    return { path: relativePath, url: buildPublicUrl(relativePath), skipped: true };
  }
  const result = await uploadBuffer(relativePath, buffer, contentType);
  return { ...result, skipped: false };
}

/**
 * Purge a public CDN URL so edge nodes stop serving a deleted/changed file.
 * Requires BUNNY_API_KEY (account API key from bunny.net dashboard — not the storage AccessKey).
 */
function purgePublicUrl(publicUrl) {
  const { accountApiKey, cdnBase } = getBunnyConfig();
  if (!accountApiKey) {
    return Promise.resolve({ skipped: true, reason: 'BUNNY_API_KEY not configured' });
  }
  const url = String(publicUrl || '').trim();
  if (!url) {
    return Promise.resolve({ skipped: true, reason: 'empty url' });
  }
  if (cdnBase && !url.startsWith(cdnBase)) {
    return Promise.resolve({ skipped: true, reason: 'url outside configured CDN base' });
  }

  const options = {
    hostname: 'api.bunny.net',
    port: 443,
    method: 'POST',
    path: `/purge?url=${encodeURIComponent(url)}&async=true`,
    headers: {
      AccessKey: accountApiKey,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ url, statusCode: res.statusCode, purged: true });
        } else {
          reject(new Error(`Bunny CDN purge failed (${res.statusCode}): ${body || 'unknown error'}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Delete a file from Bunny Storage and purge its CDN URL.
 * @param {string} relativePath - Path inside the storage zone (no leading slash)
 */
function deleteFile(relativePath) {
  const { zone, apiKey, hostname } = getBunnyConfig();
  if (!zone || !apiKey) {
    throw new Error('Bunny Storage is not configured (BUNNY_STORAGE_ZONE / BUNNY_STORAGE_API_KEY)');
  }

  const cleanPath = String(relativePath || '').replace(/^\/+/, '');
  const publicUrl = buildPublicUrl(cleanPath);
  const options = {
    hostname,
    port: 443,
    method: 'DELETE',
    path: `/${zone}/${cleanPath}`,
    headers: {
      AccessKey: apiKey,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const deleted = res.statusCode >= 200 && res.statusCode < 300 || res.statusCode === 404;
        if (!deleted) {
          reject(new Error(`Bunny delete failed (${res.statusCode}): ${body || 'unknown error'}`));
          return;
        }

        purgePublicUrl(publicUrl)
          .then((purgeResult) => {
            resolve({
              path: cleanPath,
              url: publicUrl,
              statusCode: res.statusCode,
              purge: purgeResult,
            });
          })
          .catch((purgeErr) => {
            console.warn(`[bunny] Storage deleted but CDN purge failed for ${publicUrl}:`, purgeErr.message);
            resolve({
              path: cleanPath,
              url: publicUrl,
              statusCode: res.statusCode,
              purge: { purged: false, error: purgeErr.message },
            });
          });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Delete from storage (when path is known) and purge every related CDN URL.
 */
async function deleteStorageAndPurgeUrls(relativePath, extraUrls = []) {
  const cleanPath = String(relativePath || '').replace(/^\/+/, '');
  const urls = new Set(
    (extraUrls || [])
      .map((url) => String(url || '').trim())
      .filter(Boolean),
  );
  if (cleanPath) {
    urls.add(buildPublicUrl(cleanPath));
  }

  let deleteResult = null;
  if (cleanPath) {
    deleteResult = await deleteFile(cleanPath);
    if (deleteResult?.url) {
      urls.delete(deleteResult.url);
    }
  }

  const purgeResults = [];
  for (const url of urls) {
    try {
      const purgeResult = await purgePublicUrl(url);
      purgeResults.push({ url, ...purgeResult });
    } catch (err) {
      purgeResults.push({ url, purged: false, error: err.message });
      console.warn(`[bunny] CDN purge failed for ${url}:`, err.message);
    }
  }

  return { path: cleanPath || null, deleteResult, purgeResults };
}

module.exports = {
  getBunnyConfig,
  isBunnyConfigured,
  isBunnyPurgeConfigured,
  buildPublicUrl,
  uploadBuffer,
  uploadBufferIfMissing,
  fileExists,
  purgePublicUrl,
  deleteFile,
  deleteStorageAndPurgeUrls,
};
