const { query } = require('../config/database');

let schemaEnsured = false;

async function ensureSecuritySchema() {
  if (schemaEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_security_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    schemaEnsured = true;
  } catch (err) {
    console.warn('[adminSecurityService] Schema ensure warning:', err.message);
  }
}

/**
 * Get active admin panel gate password (DB priority, env fallback)
 */
async function getAdminPanelPassword() {
  await ensureSecuritySchema();
  try {
    const res = await query(`SELECT value FROM admin_security_settings WHERE key = 'admin_panel_password' LIMIT 1`);
    if (res.rows.length > 0 && res.rows[0].value) {
      return String(res.rows[0].value).trim();
    }
  } catch (err) {
    console.warn('[adminSecurityService] Failed to read password from DB, using fallback:', err.message);
  }
  return String(process.env.ADMIN_PANEL_PASSWORD || '2316').trim();
}

/**
 * Verify candidate password against active password
 */
async function verifyAdminPassword(candidate) {
  if (!candidate) return false;
  const activePassword = await getAdminPanelPassword();
  return String(candidate).trim() === activePassword;
}

/**
 * Update admin panel gate password in database
 */
async function setAdminPanelPassword(newPassword) {
  if (!newPassword || String(newPassword).trim().length < 3) {
    throw new Error('New password must be at least 3 characters long');
  }
  await ensureSecuritySchema();
  const cleanPass = String(newPassword).trim();
  await query(`
    INSERT INTO admin_security_settings (key, value, updated_at)
    VALUES ('admin_panel_password', $1, NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW()
  `, [cleanPass]);

  return { success: true, message: 'Admin panel password updated successfully' };
}

/**
 * Get password metadata (last updated)
 */
async function getPasswordMetadata() {
  await ensureSecuritySchema();
  try {
    const res = await query(`SELECT updated_at FROM admin_security_settings WHERE key = 'admin_panel_password' LIMIT 1`);
    const isCustom = res.rows.length > 0;
    return {
      isCustom,
      lastUpdated: isCustom ? res.rows[0].updated_at : null,
      source: isCustom ? 'database' : 'environment_default',
    };
  } catch (err) {
    return {
      isCustom: false,
      lastUpdated: null,
      source: 'environment_default',
    };
  }
}

module.exports = {
  getAdminPanelPassword,
  verifyAdminPassword,
  setAdminPanelPassword,
  getPasswordMetadata,
};
