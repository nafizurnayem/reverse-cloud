# Reverse Cloud architecture

## Runtime flow

```text
Browser
  -> Cloudflare DNS, HTTPS, and named Tunnel
    -> Next.js web service
      -> Supabase Auth, Postgres, Storage, and pgvector
      -> FastAPI AI service
        -> Ollama language and embedding models
        -> Supabase through the restricted ai_service database role
```

The browser never receives service credentials. Next.js owns user-facing
navigation, authentication callbacks, protected portals, and public API
boundaries. FastAPI owns chat orchestration, retrieval, AI tools, and AI
background processing. Supabase remains the source of truth.

## Complete repository layout

```text
reverse-cloud/
├── apps/web/                  Next.js application
│   ├── messages/              English and Bangla translations
│   ├── src/app/               Pages, layouts, route handlers, robots, sitemap
│   │   ├── [locale]/          Internal locale segment; hidden from public URLs
│   │   │   ├── (public)/      Marketing, services, scheduling, blog, legal
│   │   │   ├── (auth)/        Login, OAuth callback, invitation acceptance
│   │   │   ├── admin/         Staff workspace and server actions
│   │   │   └── portal/        Client dashboard, projects, and payments
│   │   ├── api/               Browser-facing JSON and webhook endpoints
│   │   └── v1/                Stable compatibility endpoints
│   ├── src/components/        Reusable UI grouped by business area
│   ├── src/i18n/              Routing, request locale, navigation helpers
│   ├── src/lib/               Domain helpers and external integrations
│   ├── src/proxy.ts           Locale canonicalization and route protection
│   └── tests/                 Web unit and integration tests
├── services/ai/               FastAPI and PydanticAI service
│   ├── app/api/               HTTP and streaming transport
│   ├── app/application/       Chat use-case orchestration
│   ├── app/domain/            Conversation and response rules
│   ├── app/agents/            Agent definitions, prompts, model setup
│   ├── app/tools/             Estimation, services, leads, projects, scheduling
│   ├── app/retrieval/         Embeddings, ingestion, and knowledge search
│   ├── app/ports/             Repository interfaces
│   ├── app/adapters/          Postgres and static implementations
│   ├── app/jobs/              Outbox, monitoring, reports, and review jobs
│   ├── app/security/          HMAC signing and prompt guardrails
│   ├── scripts/               Knowledge synchronization and reindexing
│   ├── evals/                 Reproducible response-quality evaluations
│   └── tests/                 API, unit, integration, and security tests
├── supabase/
│   ├── migrations/            Ordered schema and policy history; never rewrite
│   ├── tests/database/        Database contract and RLS tests
│   ├── seed.sql               Local seed data
│   └── config.toml            Supabase CLI configuration
├── ops/hosting/               Compose services and deployment automation
├── docs/
│   ├── api/                   API contracts
│   ├── runbooks/              Operational procedures
│   ├── research/              Decision-support research
│   └── architecture.md        This file
├── scripts/                   Cross-service utilities
├── Dockerfile.preview         Production web image
└── Dockerfile.ai              Production AI image
```

## File placement rules

- Put a user-visible page or API route in `apps/web/src/app`.
- Put reusable visual code in `apps/web/src/components`, grouped by feature.
- Put validation, data access, authentication, and domain helpers in
  `apps/web/src/lib`; route files should stay thin.
- Put AI orchestration in `application`, pure business concepts in `domain`,
  external implementations in `adapters`, and callable agent capabilities in
  `tools`.
- Add schema changes only as new ordered Supabase migrations. Never edit an
  applied migration to change production behavior.
- Keep deployment logic in `ops/hosting`; secrets and runtime state remain on
  the server and are never committed.

## Deployment boundaries

`ops/hosting/deploy.sh` builds commit-tagged web and AI images, starts candidate
containers on separate ports, checks health, synchronizes AI knowledge, and
then replaces live containers. Docker Compose restarts services automatically.
Two tunnel connectors use different transports to reduce Cloudflare connector
interruptions.
