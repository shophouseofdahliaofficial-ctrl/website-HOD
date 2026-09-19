const { Pool } = require('pg');
require('dotenv').config();

/**
 * Check and update user roles in the database
 * Usage: node src/database/check_user_roles.js [email] [role]
 * Example: node src/database/check_user_roles.js admin@example.com admin
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
  connectionTimeoutMillis: 15000,
});

async function checkAndUpdateRoles() {
  const client = await pool.connect();
  const [email, newRole] = process.argv.slice(2);
  
  try {
    if (email && newRole) {
      // Update specific user
      const role = newRole.toLowerCase();
      if (role !== 'admin' && role !== 'customer') {
        console.error('❌ Role must be "admin" or "customer"');
        process.exit(1);
      }
      
      const result = await client.query(
        'UPDATE users SET role = $1, updated_at = NOW() WHERE email = $2 RETURNING id, name, email, role',
        [role, email]
      );
      
      if (result.rows.length === 0) {
        console.log(`❌ User with email "${email}" not found in database`);
      } else {
        console.log('✅ User role updated:');
        console.log(`   ID: ${result.rows[0].id}`);
        console.log(`   Name: ${result.rows[0].name}`);
        console.log(`   Email: ${result.rows[0].email}`);
        console.log(`   Role: ${result.rows[0].role}`);
      }
    } else {
      // List all users
      console.log('📋 All users in database:\n');
      const result = await client.query(
        'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
      );
      
      if (result.rows.length === 0) {
        console.log('   No users found in database');
      } else {
        result.rows.forEach((user, index) => {
          console.log(`${index + 1}. ${user.name} (${user.email})`);
          console.log(`   ID: ${user.id}`);
          console.log(`   Role: ${user.role}`);
          console.log(`   Created: ${user.created_at}`);
          console.log('');
        });
      }
      
      console.log('\n💡 To update a user role, run:');
      console.log('   node src/database/check_user_roles.js <email> <role>');
      console.log('   Example: node src/database/check_user_roles.js admin@example.com admin');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndUpdateRoles();
