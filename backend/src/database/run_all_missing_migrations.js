const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Run All Missing Migrations
 * Creates the base tables (users, products, categories, subscriptions, etc.)
 * then delivery_schedules, paused_dates, payments, addresses, banners, coupons, and verifications tables
 * in a clean, order-safe, and idempotent manner.
 */
async function runAllMigrations() {
  try {
    console.log('[MIGRATION] Starting all missing database migrations...\n');

    // 0. Execute SETUP_DATABASE.sql to create base tables (users, products, subscriptions, etc.)
    console.log('📋 Running base SETUP_DATABASE.sql migration...');
    const setupDbFile = path.join(__dirname, '../../SETUP_DATABASE.sql');
    if (fs.existsSync(setupDbFile)) {
      const sql = fs.readFileSync(setupDbFile, 'utf8');
      await query(sql);
      console.log('✅ Base tables (users, products, subscriptions, categories, reviews) ready');
    } else {
      console.warn('⚠️  Warning: SETUP_DATABASE.sql not found at project root');
    }

    // 1. Create delivery_schedules table
    console.log('\n📋 Creating delivery_schedules table...');
    await query(`
      CREATE TABLE IF NOT EXISTS delivery_schedules (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
          delivery_date DATE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'skipped', 'cancelled')),
          delivered_at TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(subscription_id, delivery_date)
      );
      CREATE INDEX IF NOT EXISTS idx_delivery_schedules_date ON delivery_schedules(delivery_date);
      CREATE INDEX IF NOT EXISTS idx_delivery_schedules_subscription ON delivery_schedules(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_schedules_status ON delivery_schedules(status);
      CREATE INDEX IF NOT EXISTS idx_delivery_schedules_date_status ON delivery_schedules(delivery_date, status);
    `);
    console.log('✅ delivery_schedules table ready');

    // 2. Create paused_dates table
    console.log('\n📋 Creating paused_dates table...');
    await query(`
      CREATE TABLE IF NOT EXISTS paused_dates (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          reason TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(subscription_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_paused_dates_subscription ON paused_dates(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_paused_dates_date ON paused_dates(date);
    `);
    console.log('✅ paused_dates table ready');

    // 3. Create payments table
    console.log('\n📋 Creating payments table...');
    await query(`
      CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
          razorpay_payment_id VARCHAR(255) UNIQUE NOT NULL,
          razorpay_order_id VARCHAR(255) NOT NULL,
          amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
          currency VARCHAR(3) NOT NULL DEFAULT 'INR',
          status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
          payment_method VARCHAR(50),
          paid_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_payments_razorpay_id ON payments(razorpay_payment_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    `);
    console.log('✅ payments table ready');

    // 4. Create trigger function and triggers for auto-updating timestamps
    console.log('\n⚡ Setting up updated_at triggers...');
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_delivery_schedules_updated_at ON delivery_schedules;
      CREATE TRIGGER update_delivery_schedules_updated_at BEFORE UPDATE ON delivery_schedules
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
      CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Triggers configured');

    // 5. Execute other SQL migration files from the directory
    const sqlFiles = [
      'create_addresses_table.sql',
      'create_banners_table.sql',
      'create_coupons_table_direct.sql',
      'create_verifications_table.sql',
      'add_app_download_site_content.sql',
      'add_coming_soon_site_content.sql',
      'add_help_support_content.sql',
      'add_logo_site_content.sql'
    ];

    for (const fileName of sqlFiles) {
      console.log(`\n📂 Running migration file: ${fileName}...`);
      const filePath = path.join(__dirname, fileName);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        await query(sql);
        console.log(`✅ ${fileName} completed successfully`);
      } else {
        console.warn(`⚠️  Warning: File ${fileName} not found in ${__dirname}`);
      }
    }

    console.log('\n🎉 ALL MISSING MIGRATIONS COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Migrations failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  runAllMigrations()
    .then(() => {
      console.log('\nMigration execution script completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nFatal error during migration execution:', error);
      process.exit(1);
    });
}

module.exports = { runAllMigrations };
