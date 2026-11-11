# Reverse Cloud

Reverse Cloud is a bilingual services platform with a Next.js website, secure
client and staff portals, a FastAPI agentic assistant, Supabase, and Docker
hosting through a named Cloudflare Tunnel.

## Repository structure

| Path | Responsibility |
| --- | --- |
| `apps/web` | Public website, authentication, admin/client portals, API routes, and browser chat UI |
| `services/ai` | FastAPI chat service, agent tools, retrieval, background jobs, and AI tests |
| `supabase` | Database migrations, seed data, Row Level Security, and database tests |
| `ops/hosting` | Docker Compose deployment, health checks, rollback, tunnel, and activity logs |
| `docs` | Architecture, API contracts, operational runbooks, and research |
| `scripts` | Repository-level diagnostic and load-test utilities |

See [docs/architecture.md](docs/architecture.md) for the full file-placement
guide and runtime flow.

## Local development

Requirements:

- Node.js 22 and pnpm 10.34.6
- Python 3.12 for the AI service
- Supabase credentials for database-backed features

```bash
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

The web app opens at `http://localhost:3000`. Put web settings in
`apps/web/.env.local`, using `apps/web/.env.example` as the template. AI
settings belong in `services/ai/.env.local`.

Useful commands:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js development server |
| `pnpm build` | Create the production web build |
| `pnpm lint` | Run ESLint with zero warnings |
| `pnpm typecheck` | Generate route types and check TypeScript |
| `pnpm test` | Run web unit and integration tests |
| `pnpm test:i18n` | Test both languages against a running web server |
| `pytest services/ai` | Run the AI service test suite |

## URLs and language

All browser-facing URLs are clean and language-neutral, such as `/services`,
`/portal`, and `/admin`. English or Bangla is stored in the `NEXT_LOCALE`
cookie. Legacy `/en/...` and `/bn/...` links redirect to the clean equivalent.

Public pages live under `apps/web/src/app/[locale]/(public)`. Use navigation
helpers from `@/i18n/navigation`; do not manually add locale prefixes.

## Authentication and authorization

Supabase Auth provides Google OAuth and email sign-in links. The proxy refreshes
sessions and protects `/portal`, `/admin`, `/developer`, and `/project_manager`.
Staff authorization comes only from active database roles, never user metadata.
Protected layouts repeat the authorization check on the server.

Never expose the Supabase service-role key through a `NEXT_PUBLIC_` variable.

## Production hosting

The Ubuntu host runs commit-tagged Docker images for the web and AI services,
Ollama, background workers, and two Cloudflare Tunnel connectors. Deployment
tests candidate containers before replacing the live containers and rolls back
failed health checks.

- [Manual hosting guide](MANUAL_HOSTING_GUIDE.md)
- [Hosting operations](HOSTING_PREVIEW.md)
- [Docker hosting control plane](ops/hosting/README.md)
