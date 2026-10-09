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

The home page runs without external services or environment variables. Existing
feature folders and message files are preserved for the next phases. The six
unfinished API endpoints return JSON with HTTP 501 for their intended methods
(GET for schedule slots; POST for the others).

The original locale/auth proxy is preserved in `apps/web/src/proxy.ts.example`.
It is inactive until i18n routing, Supabase clients, login, and server-side
authorization are implemented. Admin and portal pages are not implemented yet.
When implementing localization, move the home page into the existing
`[locale]/(public)` group and make the root layout's language locale-aware.

For future web integrations, put local secrets in `apps/web/.env.local`, using
the relevant keys from `.env.example`. Next.js does not automatically load the
repository-root `.env.local` for this app. Never expose service-role secrets
through `NEXT_PUBLIC_` variables.

The application skeleton follows the project plan in `docs/00-plan.md`.
