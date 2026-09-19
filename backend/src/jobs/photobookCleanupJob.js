const { query } = require('../config/database');
const bunnyStorage = require('../services/bunnyStorage');
const photobookProjectModel = require('../models/photobookProject');
const { deleteProjectAssets } = require('../services/photobookAssetCleanup');

const INTERVAL_MS = 24 * 60 * 60 * 1000;

async function deleteProjectRecord(projectId) {
  await query(`DELETE FROM photobook_projects WHERE id = $1`, [projectId]);
}

async function cleanupProjectBatch(rows, label) {
  if (rows.length === 0) {
    console.log(`[photobook-cleanup] No ${label} projects found.`);
    return { successCount: 0, failCount: 0 };
  }

  console.log(`[photobook-cleanup] Found ${rows.length} ${label} project(s).`);

  let successCount = 0;
  let failCount = 0;

  for (const project of rows) {
    await deleteProjectAssets(project);
    try {
      await deleteProjectRecord(project.id);
      successCount++;
    } catch (dbErr) {
      console.error(`[photobook-cleanup] Failed to delete project ${project.id}:`, dbErr.message);
      failCount++;
    }
  }

  return { successCount, failCount };
}

/**
 * Cleans up photobook projects and their Bunny Storage assets:
 * 1. Unpurchased draft/cart projects past expires_at (30 days since last edit).
 * 2. Purchased projects linked to orders delivered more than 7 days ago.
 *
 * Each file is deleted from storage and its CDN URL is purged (requires BUNNY_API_KEY).
 */
async function cleanupExpiredPhotobookProjects() {
  await photobookProjectModel.ensurePhotobookSchema();

  if (bunnyStorage.isBunnyConfigured() && !bunnyStorage.isBunnyPurgeConfigured()) {
    console.warn(
      '[photobook-cleanup] BUNNY_API_KEY is not set — storage files will be deleted but CDN links may keep working until cache expires. Add BUNNY_API_KEY from bunny.net Account → API.',
    );
  }

  console.log('[photobook-cleanup] Starting photobook projects cleanup...');

  try {
    const expiredDrafts = await photobookProjectModel.getExpiredDraftProjects();
    const deliveredPurchased = await photobookProjectModel.getDeliveredPurchasedProjectsForCleanup();

    const draftResult = await cleanupProjectBatch(expiredDrafts, 'expired draft/cart');
    const purchasedResult = await cleanupProjectBatch(
      deliveredPurchased,
      `delivered purchased (${photobookProjectModel.DELIVERED_PURCHASED_CLEANUP_DAYS}+ days)`,
    );

    const successCount = draftResult.successCount + purchasedResult.successCount;
    const failCount = draftResult.failCount + purchasedResult.failCount;

    console.log(`[photobook-cleanup] Done. Deleted ${successCount} (failed: ${failCount}).`);
  } catch (err) {
    console.error('[photobook-cleanup] Fatal error:', err);
  }
}

function startPhotobookCleanupJob() {
  if (bunnyStorage.isBunnyConfigured() && !bunnyStorage.isBunnyPurgeConfigured()) {
    console.warn(
      '[photobook-cleanup] BUNNY_API_KEY is not set — automatic CDN purge after deletion is disabled.',
    );
  }

  setTimeout(() => {
    cleanupExpiredPhotobookProjects().catch((err) => {
      console.error('[photobook-cleanup] Initial run failed:', err);
    });
  }, 45000);

  setInterval(() => {
    cleanupExpiredPhotobookProjects().catch((err) => {
      console.error('[photobook-cleanup] Daily run failed:', err);
    });
  }, INTERVAL_MS);
}

module.exports = {
  cleanupExpiredPhotobookProjects,
  startPhotobookCleanupJob,
};
