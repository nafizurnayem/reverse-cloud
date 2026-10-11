# Contact leads and notifications

The public contact form submits to `POST /api/leads`. The route validates the
payload, applies a five-per-hour IP limit through Upstash, verifies the
Cloudflare Turnstile token, and calls `create_contact_lead`. That database
function inserts the lead and queues its email and Telegram notifications in a
single transaction.

## Web configuration

Configure these values in the web deployment and in `apps/web/.env.local` for
local development:

- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RATE_LIMIT_SALT`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_EXPECTED_HOSTNAME` (recommended in production)
- `STAFF_NOTIFICATION_EMAIL`
- `TELEGRAM_CHAT_ID`

Add the production and preview hostnames to the Turnstile widget. Use
Cloudflare's documented test keys locally if a real widget is not appropriate.

## Railway outbox cron

Create a separate Railway service with `services/ai` as its root directory and
`services/ai/railway.outbox.json` as its config file. It runs every five
minutes and exits after processing one batch.

Configure:

- `DATABASE_URL_AI` using a direct Postgres connection on port 5432
- `EMAIL_API_KEY`
- `EMAIL_FROM`
- `EMAIL_API_URL` when using an email API other than the default Resend endpoint
- `TELEGRAM_BOT_TOKEN`
- `OUTBOX_BATCH_SIZE` and `OUTBOX_MAX_ATTEMPTS` when the defaults are unsuitable

The database URL must authenticate as the `ai_service` role. That role needs
`SELECT` and `UPDATE` on `public.notifications_outbox`; its RLS policies also
check the database role name. Migration `0012` grants the table privileges
automatically when `ai_service` already exists. If Member D creates the role
after applying the migration, apply this grant once:

```sql
grant select, update on public.notifications_outbox to ai_service;
```

Failed deliveries use exponential retry delays. After the configured maximum
attempts, the row remains in `failed` state with its last error for operations
review.
