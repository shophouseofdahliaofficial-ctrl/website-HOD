const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * Run Supabase migration to fix users table
 * This script updates the users table to work with Supabase Auth (UUID ids)
 */

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ SUPABASE_DB_URL or DATABASE_URL is not set in .env file');
  process.exit(1);
}

// Parse and fix the connection string (supports '@' inside the password by splitting on the LAST '@')
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

let fixedUrl = encodeDbUrlPassword(databaseUrl);

const pool = new Pool({
  connectionString: fixedUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000, // 15 seconds
  query_timeout: 20000, // 20 seconds
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting Supabase migration...\n');

    // Step 1: Check current schema
    console.log('📋 Checking current users table schema...');
    const schemaCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    if (schemaCheck.rows.length > 0) {
      console.log('Current users table columns:');
      schemaCheck.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('⚠️  users table does not exist yet');
    }

    // Step 2: Check if id is already UUID
    const idIsUuid = schemaCheck.rows.some(col => 
      col.column_name === 'id' && col.data_type === 'uuid'
    );

    if (idIsUuid) {
      console.log('\n✅ Users table already uses UUID for id');
      console.log('Checking if password_hash column exists...');
      
      const hasPasswordHash = schemaCheck.rows.some(col => col.column_name === 'password_hash');
      if (!hasPasswordHash) {
        console.log('✅ Users table is already migrated for Supabase!');
        return;
      } else {
        console.log('⚠️  password_hash column still exists, will remove it...');
      }
    }

    // Step 3: Enable UUID extension
    console.log('\n📦 Enabling UUID extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('✅ UUID extension enabled');

    // Step 4: Drop foreign key constraints
    console.log('\n🔓 Dropping foreign key constraints...');
    await client.query('ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey');
    await client.query('ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey1');
    console.log('✅ Foreign key constraints dropped');

    // Step 5: Drop old users table
    console.log('\n🗑️  Dropping old users table...');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('✅ Old users table dropped');

    // Step 6: Create new users table with UUID
    console.log('\n📝 Creating new users table with UUID id...');
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ New users table created');

    // Step 7: Create indexes
    console.log('\n📊 Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    console.log('✅ Indexes created');

    // Step 8: Update subscriptions table
    console.log('\n🔄 Updating subscriptions table...');
    
    // Check if subscriptions table exists
    const subscriptionsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'subscriptions'
      )
    `);

    if (subscriptionsExists.rows[0].exists) {
      // Drop old user_id column if it exists as integer
      await client.query('ALTER TABLE subscriptions DROP COLUMN IF EXISTS user_id');
      
      // Add user_id as UUID
      await client.query('ALTER TABLE subscriptions ADD COLUMN user_id UUID');
      
      // Add foreign key constraint
      await client.query(`
        ALTER TABLE subscriptions 
        ADD CONSTRAINT subscriptions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      
      // Create index
      await client.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)');
      console.log('✅ Subscriptions table updated');
    } else {
      console.log('⚠️  Subscriptions table does not exist, skipping...');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 New users table structure:');
    const newSchema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    newSchema.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n🎉 Migration script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
