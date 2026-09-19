const { query } = require('../config/database');
const bunnyStorage = require('../services/bunnyStorage');
const photoboothProjectModel = require('../models/photoboothProject');

// Run once per day (24 hours).
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Identifies and cleans up stale/completed photobooth projects.
 * 1. Unpurchased projects (status 'draft' or 'cart') older than 15 days.
 * 2. Purchased projects (status 'ordered') linked to orders that were delivered more than 15 days ago.
 */
async function cleanupStalePhotoboothProjects() {
  await photoboothProjectModel.ensurePhotoboothSchema();

  console.log('[photobooth-cleanup] Starting stale photobooth projects cleanup job...');

  try {
    // Select candidate projects for deletion:
    // A. status in ('draft', 'cart') and created_at < NOW() - 15 days
    // B. status = 'ordered' and the corresponding order has status = 'delivered' and delivered_at < NOW() - 15 days
    const candidates = await query(`
      SELECT id, asset_paths, generated_pdf_url, preview_url, status
      FROM photobooth_projects
      WHERE (
        status IN ('draft', 'cart')
        AND created_at < NOW() - INTERVAL '15 days'
      ) OR (
        status = 'ordered'
        AND id IN (
          SELECT DISTINCT oi.photobooth_project_id
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.status = 'delivered'
            AND o.delivered_at < NOW() - INTERVAL '15 days'
        )
      )
    `);

    const rows = candidates.rows || [];
    if (rows.length === 0) {
      console.log('[photobooth-cleanup] No stale photobooth projects found to clean up.');
      return;
    }

    console.log(`[photobooth-cleanup] Found ${rows.length} project(s) to clean up. Deleting assets from Bunny Storage...`);

    let successCount = 0;
    let failCount = 0;

    for (const project of rows) {
      let assetPaths = [];
      if (Array.isArray(project.asset_paths)) {
        assetPaths = project.asset_paths;
      } else if (project.asset_paths) {
        try {
          assetPaths = typeof project.asset_paths === 'string' ? JSON.parse(project.asset_paths) : project.asset_paths;
        } catch {
          // ignore
        }
      }

      // Delete the assets from storage:
      for (const asset of assetPaths) {
        if (asset.path) {
          try {
            console.log(`[photobooth-cleanup] Deleting asset path from Bunny: ${asset.path}`);
            await bunnyStorage.deleteFile(asset.path);
          } catch (err) {
            console.error(`[photobooth-cleanup] Failed to delete asset ${asset.path} for project ${project.id}:`, err.message);
          }
        }
      }

      // Now delete the project row from the database:
      try {
        await query(`DELETE FROM photobooth_projects WHERE id = $1`, [project.id]);
        successCount++;
      } catch (dbErr) {
        console.error(`[photobooth-cleanup] Failed to delete database record for project ${project.id}:`, dbErr.message);
        failCount++;
      }
    }

    console.log(`[photobooth-cleanup] Cleanup complete. Successfully deleted ${successCount} projects (failed: ${failCount}).`);
  } catch (err) {
    console.error('[photobooth-cleanup] Fatal error during photobooth projects cleanup:', err);
  }
}

function startPhotoboothCleanupJob() {
  // Run initial cleanup in background 30 seconds after server starts to avoid locking db during startup
  setTimeout(() => {
    cleanupStalePhotoboothProjects().catch((err) => {
      console.error('[photobooth-cleanup] Initial run failed:', err);
    });
  }, 30000);

  // Set interval to run once per day
  setInterval(() => {
    cleanupStalePhotoboothProjects().catch((err) => {
      console.error('[photobooth-cleanup] Daily cleanup run failed:', err);
    });
  }, INTERVAL_MS);
}

module.exports = {
  cleanupStalePhotoboothProjects,
  startPhotoboothCleanupJob,
};
