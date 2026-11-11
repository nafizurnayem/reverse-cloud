# Authentication setup

The application code uses Supabase Auth's server-side PKCE flow. Member D owns
the provider and redirect configuration below. Never commit the Google client
secret or Supabase service-role key.

## 1. Google Auth Platform

Create a **Web application** OAuth client and configure:

- Authorized JavaScript origins:
  - `http://localhost:3000`
  - the production app origin, such as `https://example.com`
- Authorized redirect URI:
  - hosted Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`
  - local Supabase, when used: `http://127.0.0.1:54321/auth/v1/callback`
- Scopes: `openid`, `userinfo.email`, and `userinfo.profile`

Add the Google client ID and secret to **Supabase Dashboard → Authentication →
Providers → Google**. The Google redirect URI points to Supabase, not directly to
the Next.js callback.

## 2. Supabase URL configuration

In **Authentication → URL Configuration**:

- Set the production Site URL to the production app origin.
- Add the exact production redirect URL:
  - `https://<app-domain>/auth/callback`
- Add local development: `http://localhost:3000/**`
- If Vercel previews need login, add the documented team-scoped pattern:
  `https://*-<team-or-account-slug>.vercel.app/**`

Use exact callback paths in production. Keep preview wildcards scoped to the
team/account slug.

## 3. Email magic links

In **Authentication → Providers → Email**, enable email authentication and decide
whether new users may sign up. The current application permits account creation
from a magic link, matching Google sign-in behavior. Configure a production SMTP
provider before launch; Supabase's built-in sender is intended only for testing
and is rate limited.

Keep the standard Supabase magic-link confirmation URL in the email template.
The application starts the PKCE flow and sends users back through the clean
`/auth/callback` path allowlisted above.

## 4. Web environment

Create `apps/web/.env.local` locally and configure:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
```

The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` works when a publishable key is not
available. Configure equivalent values in the Docker hosting environment, with
the exact production origin in `NEXT_PUBLIC_SITE_URL`.

## 5. Admin provisioning

Google sign-in creates the Auth user and profile. It does not grant admin access.
After the intended staff user signs in once, insert an active `staff_roles` row
for that user's ID and the seeded `admin` role ID using a trusted database/admin
process. Do not let users assign their own roles.

## 6. Acceptance check

1. Open `/login`, sign in, and confirm return to `/portal` (or the requested
   safe path).
2. Refresh the destination and confirm the session remains active.
3. Switch to Bangla, confirm the URL stays `/login`, and test sign-out.
4. Confirm an ordinary signed-in user receives no admin access.
5. Assign the intended admin role, then confirm that user can reach `/admin`.
6. Verify `/login?next=https://example.net` falls back to `/portal`.
7. Request a magic link from `/login`, open it in the same browser, and
   confirm it returns to the requested safe path with a persistent session.
8. Switch to Bangla and repeat the magic-link flow; confirm status and error
   messages remain in Bangla while URLs stay locale-free.
