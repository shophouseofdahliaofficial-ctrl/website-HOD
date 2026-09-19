const { Pool } = require('pg');
require('dotenv').config();

/**
 * Test database connection
 * This script helps diagnose database connection issues
 */

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ SUPABASE_DB_URL or DATABASE_URL is not set in .env file');
  process.exit(1);
}

console.log('🔍 Testing database connection...\n');
console.log('Database URL (masked):', databaseUrl.replace(/:[^:@]+@/, ':****@'));

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
if (fixedUrl !== databaseUrl) {
  console.log('✅ Password URL-encoded\n');
}

const pool = new Pool({
  connectionString: fixedUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function testConnection() {
  const startTime = Date.now();
  
  try {
    console.log('⏳ Attempting to connect...');
    const client = await pool.connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ Connected in ${connectTime}ms\n`);
    
    // Test 1: Simple query
    console.log('📊 Test 1: Simple query (SELECT NOW())...');
    const queryStart = Date.now();
    const result = await client.query('SELECT NOW() as current_time');
    const queryTime = Date.now() - queryStart;
    console.log(`✅ Query successful in ${queryTime}ms`);
    console.log(`   Result: ${result.rows[0].current_time}\n`);
    
    // Test 2: Check users table
    console.log('📊 Test 2: Check users table schema...');
    const schemaStart = Date.now();
    const schemaResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    const schemaTime = Date.now() - schemaStart;
    
    if (schemaResult.rows.length === 0) {
      console.log('⚠️  Users table does not exist!\n');
      console.log('   You need to create the users table first.');
      console.log('   See: milko-backend/MIGRATE_TO_SUPABASE.md\n');
    } else {
      console.log(`✅ Schema check successful in ${schemaTime}ms`);
      console.log('   Users table columns:');
      schemaResult.rows.forEach(col => {
        console.log(`     - ${col.column_name} (${col.data_type})`);
      });
      
      // Check if id is UUID
      const idColumn = schemaResult.rows.find(col => col.column_name === 'id');
      if (idColumn && idColumn.data_type === 'uuid') {
        console.log('\n✅ Users table is correctly configured for Supabase!');
      } else if (idColumn && idColumn.data_type === 'integer') {
        console.log('\n❌ Users table needs migration!');
        console.log('   The id column is integer but should be UUID.');
        console.log('   Run the migration in Supabase SQL Editor.');
        console.log('   See: milko-backend/MIGRATE_TO_SUPABASE.md');
      }
      console.log('');
    }
    
    // Test 3: Check products table
    console.log('📊 Test 3: Check products table...');
    const productsStart = Date.now();
    try {
      const productsResult = await client.query('SELECT COUNT(*) as count FROM products');
      const productsTime = Date.now() - productsStart;
      console.log(`✅ Products table exists (${productsResult.rows[0].count} products) in ${productsTime}ms\n`);
    } catch (error) {
      console.log(`⚠️  Products table query failed: ${error.message}\n`);
    }
    
    client.release();
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`\n❌ Connection failed after ${totalTime}ms`);
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Possible solutions:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify SUPABASE_DB_URL is correct in .env');
      console.error('   3. Check if Supabase database is accessible');
      console.error('   4. Try using Supabase connection pooler URL instead');
      console.error('      (Available in Supabase Dashboard > Settings > Database > Connection Pooling)');
    }
    
    throw error;
  } finally {
    await pool.end();
  }
}

testConnection()
  .then(() => {
    console.log('\n✅ Connection test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Connection test failed');
    process.exit(1);
  });
