# Admin Panel Security Setup

## Overview

The admin panel has **two layers of security**:

1. **Role-based access**: User must have `admin` role in the database
2. **Password gate**: Even admin users must enter an additional password to access the panel

This provides extra protection against unauthorized access, even if someone somehow gets admin role.

## Setting the Admin Panel Password

The password is verified by the **backend** (`POST /api/auth/verify-admin-password`), not in the browser.

### Backend (Render / local `.env`)

Set on the **backend** service:

```bash
ADMIN_PANEL_PASSWORD=YourStrongPasswordHere!
```

- Default if unset: `2316`
- This is **not** your `SUPABASE_DB_URL` / database password
- After changing it on Render, redeploy the backend

### Local development

Add to `milko-backend-main/.env`:

```bash
ADMIN_PANEL_PASSWORD="2316"
```

Restart the backend after changing it.

## How It Works

1. User logs in with admin credentials
2. Gets redirected to `/admin`
3. **Password gate appears** - user must enter the admin panel password
4. If correct, access is granted for the current browser session
5. Password verification is stored in `sessionStorage` (clears when browser closes)

## Security Features

- ✅ Password verification is session-based (clears on browser close)
- ✅ Password is checked client-side (fast, but visible in code)
- ✅ Combined with role-based access for double protection
- ✅ "Return to website" link allows easy exit
- ✅ Failed attempts show error message

## Changing the Password

1. Update `ADMIN_PANEL_PASSWORD` in the backend `.env` (local) or Render environment variables (production)
2. Restart / redeploy the backend
3. Coming-soon bypass and admin gate sessions may need a browser refresh

## Production Deployment

When deploying to production:

1. Set `ADMIN_PANEL_PASSWORD` on **Render** (backend service), not Vercel
2. Use a strong, randomly generated password
3. Redeploy the backend after changing it
4. Share the password securely with authorized admin users only

## Troubleshooting

**Password not working?**
- Confirm you are using `ADMIN_PANEL_PASSWORD`, **not** the Supabase/database password
- Check `ADMIN_PANEL_PASSWORD` on the **backend** (Render), not the frontend (Vercel)
- Default when unset: `2316`
- Restart the backend after changing the environment variable

**Want to reset verification?**
- Close and reopen the browser, OR
- Clear sessionStorage manually in browser DevTools
