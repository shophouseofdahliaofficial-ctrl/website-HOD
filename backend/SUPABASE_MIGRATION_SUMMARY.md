# Supabase Migration Summary

## What Changed

The backend has been migrated from custom JWT authentication to Supabase Auth. Here's what was updated:

### ✅ Completed Changes

1. **Installed Supabase Client**
   - Added `@supabase/supabase-js` package

2. **Created Supabase Configuration**
   - New file: `src/config/supabase.js`
   - Configures Supabase client for Auth and Admin operations

3. **Updated Database Configuration**
   - `src/config/database.js` now supports Supabase connection string
   - Uses `SUPABASE_DB_URL` or falls back to `DATABASE_URL`

4. **Updated Authentication Service**
   - `src/services/authService.js` now uses Supabase Auth:
     - `register()` → `supabase.auth.signUp()`
     - `login()` → `supabase.auth.signInWithPassword()`
     - Returns Supabase JWT tokens instead of custom JWTs

5. **Updated Auth Middleware**
   - `src/middleware/auth.js` now verifies Supabase JWT tokens
   - Uses `supabase.auth.getUser()` to verify tokens
   - Automatically creates user profiles if missing

6. **Updated User Model**
   - `src/models/user.js` removed password handling
   - `createUser()` now only creates profiles (not auth users)
   - `verifyPassword()` deprecated (Supabase handles this)
   - `updateUser()` no longer handles password updates

7. **Database Migration**
   - Created `src/database/migrations/003_migrate_to_supabase.sql`
   - Updates users table to use UUID instead of SERIAL
   - Removes password_hash column (handled by Supabase)

8. **Documentation**
   - Created `SUPABASE_SETUP.md` with complete setup guide
   - Updated `ENV_EXAMPLE.md` with Supabase variables

---

## Breaking Changes

### ⚠️ Important Notes

1. **User IDs are now UUIDs**
   - Previously: Integer IDs (1, 2, 3...)
   - Now: UUIDs (e.g., `550e8400-e29b-41d4-a716-446655440000`)
   - **Action Required**: Update database schema and any hardcoded user ID references

2. **Password Management**
   - Passwords are now handled by Supabase Auth
   - Cannot directly query/update passwords in your database
   - Password changes must use Supabase Auth API

3. **JWT Tokens**
   - Tokens are now Supabase JWT tokens, not custom JWTs
   - Token structure may differ
   - Frontend may need updates if it decodes tokens

4. **Database Schema**
   - Users table structure changed:
     - `id`: SERIAL → UUID
     - `password_hash`: Removed (handled by Supabase)
   - Subscriptions table: `user_id` must be UUID

---

## Migration Steps for Existing Projects

If you have an existing database with data:

1. **Backup your database** first!

2. **Export existing users**:
   ```sql
   COPY (SELECT * FROM users) TO '/tmp/users_backup.csv' CSV HEADER;
   ```

3. **Run the migration**:
   ```bash
   psql $SUPABASE_DB_URL -f src/database/migrations/003_migrate_to_supabase.sql
   ```

4. **Create Supabase Auth users** for each existing user:
   - Use Supabase Admin API or dashboard
   - Or create a migration script to bulk create users

5. **Update user IDs** in related tables (subscriptions, etc.)

6. **Test thoroughly** before deploying to production

---

## For New Projects

If you're starting fresh:

1. Follow `SUPABASE_SETUP.md`
2. Run the migration script (it will create the new structure)
3. Start using Supabase Auth immediately

---

## API Compatibility

The API endpoints remain the same:

- `POST /api/auth/signup` - Still works, now uses Supabase
- `POST /api/auth/login` - Still works, now uses Supabase
- `GET /api/auth/me` - Still works, verifies Supabase token
- `POST /api/auth/logout` - Still works (client-side token removal)

**Response format is unchanged** - still returns `{ user, token }`

---

## Environment Variables

New required variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (optional but recommended)

Old variables still supported:
- `DATABASE_URL` (falls back if `SUPABASE_DB_URL` not set)
- `JWT_SECRET` (still used for some operations)

---

## Testing

After migration, test:

1. ✅ User signup
2. ✅ User login
3. ✅ Token verification (protected routes)
4. ✅ User profile creation
5. ✅ Admin operations (if applicable)

---

## Next Steps

1. **Update Frontend** (if needed):
   - Ensure it handles UUID user IDs
   - Update token storage/usage if needed
   - Test authentication flows

2. **Database Migration**:
   - Run migration script
   - Update any hardcoded user ID references
   - Test with sample data

3. **Production Deployment**:
   - Set up Supabase production project
   - Configure environment variables
   - Test thoroughly before going live

---

## Support

- See `SUPABASE_SETUP.md` for detailed setup instructions
- Check Supabase documentation: https://supabase.com/docs
- Review migration script: `src/database/migrations/003_migrate_to_supabase.sql`

