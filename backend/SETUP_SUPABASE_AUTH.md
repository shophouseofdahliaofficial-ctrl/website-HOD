# Supabase Authentication Setup

This guide explains how to set up Supabase authentication with automatic user profile creation.

## Step 1: Run the Database Trigger

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `src/database/create_user_trigger.sql`
4. Click **Run**

This will create a database trigger that automatically creates a row in the `users` table whenever a new user signs up in Supabase Auth.

## Step 2: Verify the Trigger

After running the SQL, you can verify it worked:

1. Go to **Database** → **Triggers** in Supabase Dashboard
2. You should see:
   - `on_auth_user_created` - Triggered when a new user signs up
   - `on_auth_user_updated` - Triggered when user data is updated

## Step 3: Test Signup

1. Sign up a new user through your app
2. Check the `users` table in Supabase Dashboard
3. You should see a new row automatically created with:
   - `id` - UUID matching the auth user ID
   - `name` - From signup form or email prefix
   - `email` - User's email
   - `role` - Defaults to 'customer'

## Step 4: Change User Role to Admin

To make a user an admin:

1. Go to **Database** → **Table Editor** → `users` table
2. Find the user by email
3. Click on the `role` field
4. Change it from `customer` to `admin`
5. Save

The user will need to logout and login again for the role change to take effect.

## How It Works

1. **Signup**: User signs up → Supabase Auth creates auth user → Database trigger creates profile in `users` table
2. **Login**: User logs in → Backend verifies token → Fetches profile from `users` table → Returns user with role
3. **Role Check**: Backend reads role from `users` table (not from auth metadata)

## Troubleshooting

### User profile not created on signup

- Check if the trigger exists in Supabase Dashboard → Database → Triggers
- Check Supabase logs for errors
- The backend will create the profile manually if the trigger fails

### Role not working

- Make sure you changed the role in the `users` table (not in auth metadata)
- User needs to logout and login again after role change
- Check backend logs to see what role is being read
