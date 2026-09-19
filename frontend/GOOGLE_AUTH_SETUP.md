# Google Sign-In / Sign-Up Setup

This guide walks you through enabling Google OAuth with Supabase for the Milko app.

---

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project or select an existing one.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. If asked, configure the **OAuth consent screen**:
   - User type: **External** (or Internal for workspace-only)
   - App name: **Milko**
   - User support email: your email
   - Developer contact: your email
   - Save
5. Create **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Name: e.g. **Milko Web**
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
     - `https://yourdomain.com` (e.g. `https://milko.in`)
   - **Authorized redirect URIs:**  
     Use the **exact** callback URL from Supabase (step 2 below). It looks like:
     - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
   - Create and copy the **Client ID** and **Client Secret**.

---

## 2. Supabase Dashboard

1. Open your [Supabase project](https://supabase.com/dashboard).
2. **Authentication → URL Configuration**
   - **Site URL:**  
     - Dev: `http://localhost:3000`  
     - Prod: `https://yourdomain.com`
   - **Redirect URLs:** add:
     - `http://localhost:3000/auth/callback`
     - `https://yourdomain.com/auth/callback`
3. **Authentication → Providers → Google**
   - Enable **Google**
   - **Client ID:** from Google Cloud Console
   - **Client Secret:** from Google Cloud Console
   - **Callback URL (for Google):**  
     Shown here; this is what you must add in Google’s **Authorized redirect URIs** (step 1).

---

## 3. Frontend Environment

In `milko-frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR-PROJECT-REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR-SUPABASE-ANON-KEY>
```

- **NEXT_PUBLIC_SUPABASE_URL:** Supabase project URL (Project Settings → API).
- **NEXT_PUBLIC_SUPABASE_ANON_KEY:** Supabase anon/public key (Project Settings → API).

Use the same Supabase project as your backend. The anon key is safe to use in the browser.

---

## 4. Backend (no code changes needed)

The backend already:

- Verifies Supabase JWTs (including from Google OAuth) in `auth` middleware.
- Creates/updates `users` when `/api/auth/me` is called with a new Google user.

No new env vars or routes are required for Google.

---

## 5. Flow

1. User clicks **Sign in with Google** on Login or Sign Up.
2. Supabase redirects to Google; user signs in.
3. Google redirects to Supabase; Supabase redirects to your app at `/auth/callback`.
4. The callback page reads the session, stores `access_token` in your auth storage, and redirects to `/` (or a saved `returnTo`).
5. On load, `AuthContext` sees the token, calls `/api/auth/me`; the backend ensures the user exists and returns profile/role. The app treats the user as logged in.

---

## 6. Checklist

- [ ] Google OAuth client created (Web application).
- [ ] Supabase callback URL added in Google **Authorized redirect URIs**.
- [ ] Google provider enabled in Supabase with correct Client ID and Secret.
- [ ] Supabase **Redirect URLs** include `/auth/callback` for your app.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `milko-frontend/.env.local`.
- [ ] Frontend deps installed: `npm install @supabase/supabase-js` in `milko-frontend`.

---

## 7. Troubleshooting

- **Redirect URI mismatch:** The redirect URI in Google must exactly match the one shown in Supabase (Auth → Providers → Google).
- **“Access blocked: This app’s request is invalid”:** Check Authorized JavaScript origins and redirect URIs in Google. For local dev, include `http://localhost:3000`.
- **Session / 401 after Google login:** Ensure `/auth/callback` is in Supabase **Redirect URLs** and that `NEXT_PUBLIC_*` are set and the frontend was rebuilt/restarted after changing `.env.local`.

### `bad_oauth_state` / "OAuth callback with invalid state"

If the URL becomes `/?error=invalid_request&error_code=bad_oauth_state&...` after clicking Continue on Google:

1. **Supabase Redirect URLs** (Authentication → URL Configuration)  
   The `redirectTo` we send is `https://<your-domain>/auth/callback`. It must match **exactly**:
   - `https://milko.in/auth/callback`
   - If you use `www`, also add: `https://www.milko.in/auth/callback`  
   No trailing slash. Same scheme (https) and host as your live site.

2. **Site URL**  
   Set **Site URL** to your main app URL, e.g. `https://milko.in` (or `https://www.milko.in` if that is canonical). This is where Supabase sends the user when something goes wrong.

3. **Cookies / privacy**  
   Supabase uses a cookie for the OAuth state. If it’s blocked, you get `bad_oauth_state`:
   - Try in **Chrome or Firefox** with default (non‑strict) settings.
   - Avoid **Safari** or “Block third‑party cookies” / strict tracking protection for a test.
   - Use a **normal** (non‑incognito) window.

4. **www vs non‑www**  
   If users can open both `https://milko.in` and `https://www.milko.in`, add **both** `/auth/callback` URLs to **Redirect URLs**. The one we send comes from `window.location.origin`, so it must be in the list.
