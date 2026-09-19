# How to Create an Admin User

## Option 1: Update Existing User to Admin (Recommended)

### Step 1: Find Your User in Supabase
1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/qbjluvlqbaxgsvtyjqid
2. Click **"Table Editor"** in the left sidebar
3. Click on the **"users"** table
4. Find your user (the one you just created)
5. Note the **"id"** (UUID) of your user

### Step 2: Update Role to Admin
1. Click on your user row to edit it
2. Find the **"role"** column
3. Change it from `customer` to `admin`
4. Click **"Save"** or press Enter

**OR use SQL Editor:**

1. Go to **"SQL Editor"** in Supabase dashboard
2. Click **"New query"**
3. Run this SQL (replace `YOUR_EMAIL_HERE` with your actual email):

```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'YOUR_EMAIL_HERE';
```

For example:
```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'test@example.com';
```

4. Click **"Run"**

### Step 3: Login to Admin Panel
1. Go to your frontend: http://localhost:3000
2. Login with your credentials
3. Navigate to `/admin` route
4. You should now have admin access!

---

## Option 2: Create a New Admin User via API

### Step 1: Sign up a new user
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@milko.in",
    "password": "admin123456"
  }'
```

### Step 2: Update role to admin in database
Run this SQL in Supabase SQL Editor:
```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'admin@milko.in';
```

### Step 3: Login with admin credentials
Use `admin@milko.in` and the password you set.

---

## Verify Admin Access

After updating the role, you can verify by:

1. **Check in database**: The user's role should be `admin`
2. **Login and test**: Try accessing admin routes
3. **Check token**: The JWT token should contain `role: "admin"`

---

## Notes

- Admin users can access `/admin/*` routes
- Customer users can only access customer routes
- The role is checked by the `requireAdmin` middleware
- Make sure to keep admin credentials secure!

