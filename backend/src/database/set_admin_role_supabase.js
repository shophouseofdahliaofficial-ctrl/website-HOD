const { supabaseAdmin } = require('../config/supabase');
require('dotenv').config();

/**
 * Set user role to admin in Supabase Auth
 * This updates the user_metadata which is used for login
 * Run: node src/database/set_admin_role_supabase.js <email> <role>
 */

async function setUserRole() {
  const [email, newRole] = process.argv.slice(2);
  
  if (!email || !newRole) {
    console.log('Usage: node src/database/set_admin_role_supabase.js <email> <role>');
    console.log('Example: node src/database/set_admin_role_supabase.js admin@example.com admin');
    console.log('');
    console.log('Valid roles: admin, customer');
    process.exit(1);
  }

  const role = newRole.toLowerCase();
  if (role !== 'admin' && role !== 'customer') {
    console.error('❌ Role must be "admin" or "customer"');
    process.exit(1);
  }

  if (!supabaseAdmin) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    console.error('   Please set it in your .env file');
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking for user with email: ${email}...`);
    
    // Get user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Failed to list users:', listError.message);
      process.exit(1);
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    console.log(`   Current role: ${user.user_metadata?.role || 'customer'}`);
    
    // Update user metadata
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        role: role,
      },
    });

    if (error) {
      console.error('❌ Failed to update user role:', error.message);
      process.exit(1);
    }

    console.log(`✅ User role updated to: ${role}`);
    console.log('');
    console.log('🎉 Done! Please logout and login again for changes to take effect.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setUserRole();
