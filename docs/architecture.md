# Architecture

## Planned services

- `apps/web`: Next.js application deployed to Vercel.
- `services/ai`: FastAPI service deployed to Railway.
- `supabase`: Postgres, Auth, Storage and pgvector.

The web application is the browser-facing boundary. The AI service is reached
through authenticated server-to-server requests and must not receive the
Supabase service-role key.
