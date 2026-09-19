-- ============================================
-- Seed Data for Milko.in
-- Creates initial admin user and sample products
-- ============================================

-- IMPORTANT: Change the password before running in production!
-- The default password is: Admin@123
-- This should be changed immediately after first login

-- Insert default admin user
-- IMPORTANT: Generate password hash first using:
-- node src/database/generate_admin_hash.js YourPassword
-- Then replace the hash below
INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
VALUES (
    'Admin User',
    'admin@milko.in',
    'REPLACE_WITH_GENERATED_HASH', -- Generate hash using generate_admin_hash.js
    'admin',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;

-- Insert sample products
INSERT INTO products (name, description, price_per_litre, is_active, created_at, updated_at)
VALUES
    (
        'Cow Milk',
        'Fresh, pure cow milk delivered daily. Rich in protein and calcium.',
        60.00,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'Buffalo Milk',
        'Creamy buffalo milk with higher fat content. Perfect for making curd and ghee.',
        70.00,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT DO NOTHING;

-- Note: To generate a proper password hash, use Node.js:
-- const bcrypt = require('bcryptjs');
-- const hash = await bcrypt.hash('YourPassword', 10);
-- console.log(hash);

