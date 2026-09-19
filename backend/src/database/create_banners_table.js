/**
 * Create Banners Table Script
 * Run this to create the banners table in your database
 * 
 * Usage: node src/database/create_banners_table.js
 */

const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function createBannersTable() {
  try {
    console.log('📋 Creating banners table...\n');

    // Create the banners table
    console.log('Creating banners table...');
    await query(`
      CREATE TABLE IF NOT EXISTS banners (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        description TEXT,
        image_url VARCHAR(500) NOT NULL,
        image_public_id VARCHAR(255),
        order_index INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Banners table created');

    // Create index
    try {
      await query(`
        CREATE INDEX IF NOT EXISTS idx_banners_active 
        ON banners(is_active, order_index) 
        WHERE is_active = true
      `);
      console.log('✅ Index created');
    } catch (error) {
      if (!error.message?.includes('already exists')) {
        console.warn('⚠️  Index creation warning:', error.message);
      }
    }

    // Create trigger function if it doesn't exist
    try {
      await query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('✅ Trigger function created/updated');
    } catch (error) {
      if (!error.message?.includes('already exists')) {
        console.warn('⚠️  Trigger function warning:', error.message);
      }
    }

    // Create trigger
    try {
      await query(`
        DROP TRIGGER IF EXISTS update_banners_updated_at ON banners;
        CREATE TRIGGER update_banners_updated_at 
        BEFORE UPDATE ON banners
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
      `);
      console.log('✅ Trigger created');
    } catch (error) {
      console.warn('⚠️  Trigger creation warning:', error.message);
    }

    console.log('\n✅ Banners table setup complete!');
    console.log('🎉 You can now upload banners in the admin panel.');
  } catch (error) {
    console.error('❌ Error creating banners table:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the script
createBannersTable()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
