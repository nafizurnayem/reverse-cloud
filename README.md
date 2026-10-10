# Reverse Cloud

Services agency platform for web development, agentic AI, automation, Python
and web scraping services.

## Repository layout

- `apps/web` — Next.js web application
- `services/ai` — FastAPI and PydanticAI service
- `supabase` — database configuration, migrations and RLS tests
- `docs` — architecture, API and operational documentation

## Development

Run the web application from the repository root:

```bash
pnpm --dir apps/web dev
```

Then open `http://localhost:3000/en` or `http://localhost:3000/bn`.

## Frontend implementation timeline

### Phase 0 — Foundation

- Configured shadcn-compatible UI metadata and shared design tokens.
- Added Inter and Noto Sans Bengali font loading.
- Built the responsive header, footer, Home shell, and Services shell.
- Added English/Bangla routing, accessibility foundations, and theme controls.

### Phase 1 — Public site and content

- Added Home, Services, Service Detail, Portfolio, Case Studies, Blog, About, Contact, and Pricing pages.
- Added the estimator UI with validation, loading, unavailable, error, and range-result states.
- Added the deterministic service-finder wizard.
- Added admin UI boundaries for services, FAQs, portfolio, blog, settings, and reviews.
- Added localized metadata, sitemap, and robots support.

### Phase 2 — AI chat UI

- Built the responsive chat widget with keyboard and mobile support.
- Added typed JSON/SSE event handling, streamed text, pending states, retry behavior, and friendly fallbacks.
- Added estimate, lead-saved, human-handoff, and extensible structured-card boundaries.
- Added explicit consent handling for human handoff.

### Phase 3 — Portal and projects

- Built read-only client portal project list and project detail views.
- Added server-supplied progress, milestones, client-visible activity, preview links, payment schedules, and invoice unavailable states.
- Added admin UI boundaries for clients, projects, milestones, updates, assignments, and payment schedules.
- Added English and Bangla HTML templates for invitations, project updates, and payment reminders.

### Phase 4 — Meetings, reviews, and legal UI

- Added the eligibility-gated portal review form and approved/featured review display.
- Added the Schedule page and booking-proposal UI with loading, empty, expired, login-required, and error states.
- Added Privacy Policy, Terms, and contact-consent UI in the existing localization structure.

## Integration status

The frontend is prepared for the backend contracts, but these services are not implemented in the current scaffold and therefore return explicit unavailable responses:

- Chat, estimator, and lead capture APIs
- Schedule slots and booking confirmation
- Review persistence and approved-review queries
- Authenticated portal data and staff CRUD APIs
- Secure signed invoice downloads

The legal pages also contain clearly marked review placeholders until approved company and legal information is supplied. No AI agent, database migration, RLS policy, payment gateway, Cal.com server integration, or infrastructure work was added.

## Validation

- `pnpm --dir apps/web exec tsc --noEmit` — passed
- `pnpm --dir apps/web build` — passed
- Local English and Bangla routes — verified with HTTP 200 responses
- Existing `pnpm --dir apps/web lint` — blocked by the deprecated interactive `next lint` setup prompt
