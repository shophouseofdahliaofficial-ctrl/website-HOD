const { supabaseAdmin } = require('../config/supabase');
const { Pool } = require('pg');
require('dotenv').config();

/**
 * Sync all users from Supabase Auth to the users table
 * This ensures all authenticated users have profiles in the database
 * Run this script to fix missing user profiles
 */

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ SUPABASE_DB_URL or DATABASE_URL is not set');
  process.exit(1);
}

// Fix URL encoding (supports '@' inside the password by splitting on the LAST '@')
const encodeDbUrlPassword = (url) => {
  if (!url || !url.includes('://') || !url.includes('@')) return url;
  if (url.includes('%')) return url; // avoid double-encoding

  try {
    const protocolEnd = url.indexOf('://') + 3;
    const lastAt = url.lastIndexOf('@');
    if (lastAt <= protocolEnd) return url;

    const userInfo = url.slice(protocolEnd, lastAt);
    const hostAndDb = url.slice(lastAt + 1);
    const firstColon = userInfo.indexOf(':');
    if (firstColon === -1) return url;

    const username = userInfo.slice(0, firstColon);
    const password = userInfo.slice(firstColon + 1);
    if (!/[ @:/?#]/.test(password)) return url;

    return `${url.slice(0, protocolEnd)}${username}:${encodeURIComponent(password)}@${hostAndDb}`;
  } catch {
    return url;
  }
};

const fixedUrl = encodeDbUrlPassword(databaseUrl);

const pool = new Pool({
  connectionString: fixedUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

async function syncUsers() {
  if (!supabaseAdmin) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    console.error('   This script requires service role key to list all users');
    process.exit(1);
  }

  const client = await pool.connect();
  
  try {
    console.log('🔄 Fetching all users from Supabase Auth...\n');
    
    // Get all users from Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Failed to fetch users from Supabase:', listError.message);
      process.exit(1);
    }
    
    console.log(`📋 Found ${users.length} users in Supabase Auth\n`);
    
    let created = 0;
    let updated = 0;
    let failed = 0;
    
    for (const authUser of users) {
      try {
        const name = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
        const email = authUser.email;
        const userId = authUser.id;
        const role = authUser.user_metadata?.role || 'customer';
        
        // Check if user exists in database
        const checkResult = await client.query(
          'SELECT id, role FROM users WHERE id = $1',
          [userId]
        );
        
        if (checkResult.rows.length > 0) {
          // User exists - update if needed
          const dbRole = checkResult.rows[0].role;
          if (dbRole !== role) {
            await client.query(
              'UPDATE users SET name = $1, email = $2, role = $3, updated_at = NOW() WHERE id = $4',
              [name, email, role, userId]
            );
            console.log(`✅ Updated: ${email} (${dbRole} → ${role})`);
            updated++;
          } else {
            console.log(`✓ Exists: ${email} (${role})`);
          }
        } else {
          // User doesn't exist - create it
          await client.query(
            `INSERT INTO users (id, name, email, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [userId, name, email, role]
          );
          console.log(`✅ Created: ${email} (${role})`);
          created++;
        }
      } catch (error) {
        console.error(`❌ Failed to sync user ${authUser.email}:`, error.message);
        failed++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${users.length}`);
    
    if (failed === 0) {
      console.log('\n✅ All users synced successfully!');
    } else {
      console.log(`\n⚠️  ${failed} users failed to sync`);
    }
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

syncUsers();
