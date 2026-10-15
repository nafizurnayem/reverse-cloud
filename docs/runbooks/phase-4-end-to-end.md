# Phase 4 end-to-end check

Use a non-production Supabase project, test Cal.com event and synthetic client.
Record the commit and results.

```bash
pnpm --filter @reverse-cloud/web lint
pnpm --filter @reverse-cloud/web typecheck
pnpm --filter @reverse-cloud/web test
pnpm --filter @reverse-cloud/web build
supabase test db
```

- English and Bangla privacy/terms pages render and consent links work.
- Both slot paths return identical results; invalid timezone, past date, range
  over 31 days and unknown meeting type fail safely.
- Signed booking creates one meeting, replay is ignored, reschedule updates the
  time, cancellation changes status, and an older event cannot reverse it.
- Google and magic-link login preserve locale and safe return paths; invite
  tokens remain one-time.
- Clients see only their own projects, meetings and payments; non-staff users
  cannot enter admin routes.
- Complete Member D's restore, kill-switch, monitoring and launch runbooks.
- Confirm no secrets, raw Cal.com payloads or real personal data appear in logs
  or the repository.
