/**
 * Utility script to generate bcrypt hash for admin password
 * Usage: node src/database/generate_admin_hash.js <password>
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'Admin@123';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  
  console.log('\n========================================');
  console.log('Password Hash Generated');
  console.log('========================================');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nUpdate the seed.sql file with this hash.');
  console.log('========================================\n');
});

