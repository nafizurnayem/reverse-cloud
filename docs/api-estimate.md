# Estimate API

`POST /api/estimate` is the Next.js server proxy. It forwards the exact JSON
body to the AI service as `POST /v1/estimate` and signs it with
`AI_HMAC_SECRET_CURRENT`.

Request fields:

- `project_type`: `web`, `automation`, `ai`, `scraping`, or `custom`
- `complexity`: `simple`, `standard`, or `complex` (default `standard`)
- `pages`: 1-100 (default 1)
- `integrations`: 0-20 (default 0)
- `features`: list of feature names
- `timeline_weeks`: optional requested timeline, 1-52

The response contains deterministic min/max hours, USD prices, a timeline, and
assumptions. Unknown feature names receive a six-hour discovery allowance.
