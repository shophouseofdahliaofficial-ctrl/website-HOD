const bunnyStorage = require('./bunnyStorage');

function parseAssetPaths(project) {
  if (Array.isArray(project.asset_paths)) return project.asset_paths;
  if (!project.asset_paths) return [];
  try {
    return typeof project.asset_paths === 'string'
      ? JSON.parse(project.asset_paths)
      : project.asset_paths;
  } catch {
    return [];
  }
}

function collectProjectCdnUrls(project) {
  const urls = new Set();
  for (const asset of parseAssetPaths(project)) {
    if (asset.url) urls.add(String(asset.url).trim());
    if (asset.path) urls.add(bunnyStorage.buildPublicUrl(asset.path));
  }
  if (project.preview_url) urls.add(String(project.preview_url).trim());
  if (project.generated_pdf_url) urls.add(String(project.generated_pdf_url).trim());
  return [...urls].filter(Boolean);
}

async function deleteProjectAssets(project) {
  const purgedUrls = new Set();
  const handledPaths = new Set();

  const markPurged = (results = []) => {
    for (const entry of results) {
      if (entry?.url) purgedUrls.add(entry.url);
    }
  };

  for (const asset of parseAssetPaths(project)) {
    if (!asset.path && !asset.url) continue;

    const pathKey = asset.path || asset.url;
    if (handledPaths.has(pathKey)) continue;
    handledPaths.add(pathKey);

    const extraUrls = asset.url ? [asset.url] : [];
    try {
      const result = await bunnyStorage.deleteStorageAndPurgeUrls(asset.path || '', extraUrls);
      markPurged(result.purgeResults);
      if (result.deleteResult?.url) purgedUrls.add(result.deleteResult.url);
    } catch (err) {
      console.error(`[photobook-cleanup] Failed to remove ${asset.path || asset.url}:`, err.message);
      if (asset.url && !purgedUrls.has(asset.url)) {
        try {
          const purgeResult = await bunnyStorage.purgePublicUrl(asset.url);
          if (purgeResult.purged) purgedUrls.add(asset.url);
        } catch (purgeErr) {
          console.error(`[photobook-cleanup] CDN purge fallback failed for ${asset.url}:`, purgeErr.message);
        }
      }
    }
  }

  for (const url of collectProjectCdnUrls(project)) {
    if (purgedUrls.has(url)) continue;
    try {
      const result = await bunnyStorage.purgePublicUrl(url);
      if (result.purged) purgedUrls.add(url);
    } catch (err) {
      console.error(`[photobook-cleanup] Failed to purge ${url}:`, err.message);
    }
  }
}

module.exports = {
  parseAssetPaths,
  collectProjectCdnUrls,
  deleteProjectAssets,
};
