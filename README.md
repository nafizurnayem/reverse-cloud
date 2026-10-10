# Reverse Cloud

Services agency platform for web development, agentic AI, automation, Python
and web scraping services.

## Repository layout

- `apps/web` — Next.js web application
- `services/ai` — FastAPI and PydanticAI service
- `supabase` — database configuration, migrations and RLS tests
- `docs` — architecture, API and operational documentation

## Development

Use Node.js 22 (see `.nvmrc`) and pnpm 10.34.6. From the repository root:

Keep the checkout on a drive with several GB of free space for dependencies and
build output. The original 477 MB FAT volume is too small for a full install;
copy or clone this repository onto a larger drive before installing there.

```bash
# With nvm installed:
nvm use

# Install pnpm in your user directory if it is not already available:
npm install --global --prefix "$HOME/.local" pnpm@10.34.6
export PATH="$HOME/.local/bin:$PATH"

pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Add the PATH export to your shell profile to make
the user-local pnpm command available in future terminals. Alternatively, use
`corepack pnpm` in place of `pnpm` if you already use Corepack.

The root scripts target `apps/web`:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create the production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint with no warnings allowed |
| `pnpm typecheck` | Generate Next.js route types and check TypeScript |

Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` before opening a PR.
Next.js 16 does not run ESLint as part of the build.

The workspace uses a hoisted pnpm layout and copies package files so installs
also work on FAT filesystems without symlink support. Commit `pnpm-lock.yaml`
alongside dependency changes; use `pnpm install --frozen-lockfile` in CI.

### Current scaffold

The home page runs without external services or environment variables. The six
unfinished API endpoints return JSON with HTTP 501 for their intended methods
(GET for schedule slots; POST for the others).

### English and Bangla

- `/en` and `/bn` render translated home pages, metadata, and HTML language tags.
- `/` redirects to the saved locale or browser language, with English as the
  fallback. Explicit locale URLs always take precedence.
- The language links switch the current pathname between English and Bangla.
- Add matching translation keys to `apps/web/messages/en.json` and `bn.json`.
- Put new public pages under `src/app/[locale]/(public)` and use the `Link`,
  `redirect`, and router helpers from `@/i18n/navigation` for localized navigation.
- `src/proxy.ts` handles locale routing; API endpoints and static files are excluded.

The original auth draft remains in `apps/web/src/proxy.ts.example` for reference.
The active proxy now combines locale routing with Supabase session refresh and
guards the admin and portal route segments.

With a development or production server running, run `pnpm test:i18n` to check
translations, redirects, language links, invalid routes, and API/asset exclusions.
Set `I18N_TEST_BASE_URL` if the server is not at `http://127.0.0.1:3000`.

### Supabase and Google login

Put web configuration in `apps/web/.env.local`, using `apps/web/.env.example`.
Next.js does not load the repository-root `.env.local` for this app. Set
`NEXT_PUBLIC_SITE_URL` to the exact app origin (for example,
`http://localhost:3000`) and configure the project URL plus publishable key. The
legacy anon key is accepted as a fallback. Never expose the service-role key
through a `NEXT_PUBLIC_` variable.

- `/en/login` and `/bn/login` start Google OAuth through Supabase PKCE.
- `/{locale}/auth/callback` exchanges the one-time code for cookie-based session
  tokens and returns the user to a validated same-locale path.
- A signed-in user can revisit the localized login page to continue or sign out.
- The proxy refreshes session cookies and preserves them on locale/auth redirects.
- Admin access requires an active database `admin` role. User metadata is never
  accepted as authorization, and protected layouts check again on the server.
- The service-role client is server-only, does not persist sessions, and has an
  ESLint import allowlist for the future validated leads, webhook, and invitation
  paths. OAuth and route guards use the user's RLS-scoped session client.

Run `pnpm test` for auth, redirect-validation, proxy, and session regressions.
See `docs/runbooks/google-oauth.md` for the Google and Supabase dashboard setup
that Member D must complete before a real sign-in can work.

The application skeleton follows the project plan in `docs/00-plan.md`.
