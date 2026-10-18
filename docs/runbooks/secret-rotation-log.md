# Secret Rotation Log & Execution Checklist

This document accompanies [`docs/runbooks/rotate-secrets.md`](./rotate-secrets.md) to record scheduled and emergency secret rotations.

> [!WARNING]
> NEVER paste actual secret values, tokens, or private keys into this document, git commits, or tickets. Record only the operator, environment, timestamp, and verification status.

---

## Secret Inventory & Rotation Matrix

| Secret Name | Rotation Mechanism | Zero-Downtime Technique | Smoke Test Verification |
|-------------|-------------------|-------------------------|--------------------------|
| `AI_HMAC_SECRET` | Dual-key rotation | Move old to `*_PREVIOUS`, new in `*_CURRENT` | `/api/chat` live request |
| `CALCOM_WEBHOOK_SECRET` | Dual-key rotation | Move old to `*_PREVIOUS`, new in `*_CURRENT` | Cal.com test webhook trigger |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard rotation | Update web app & workers simultaneously | Admin portal & outbox processor |
| `CHAT_COOKIE_SECRET` | Instance restart | Deploy simultaneously across web instances | Public chat session initialization |
| `UPSTASH_REDIS_REST_TOKEN` | Dashboard rotation | Update web app environment variables | Rate limit headers on `/api/chat` |
| `EMAIL_API_KEY` (Resend) | Dashboard rotation | Update web app & AI workers | Client invite / test outbox email |
| `TELEGRAM_BOT_TOKEN` | BotFather `/revoke` | Deploy new token to AI service worker | Trigger test token alert / outbox alert |

---

## Baseline Wave 3 Rotation Verification Record

- **Date & UTC Timestamp**: 2026-10-19 00:35:00 UTC
- **Operator**: Member D (DevOps / QA)
- **Environment**: Development / Staging (`reversecloud.dev`)
- **Status**: Verified

### Execution Verification Steps Performed:
1. **Dual-Key HMAC Validation**:
   - Verified that `apps/web/src/app/api/chat/route.ts` and `services/ai/app/security/hmac.py` properly accept `AI_HMAC_SECRET_CURRENT` and gracefully fall back to `AI_HMAC_SECRET_PREVIOUS` during transition windows.
   - Tested HMAC verification with mock rotated credentials.
2. **Cal.com Signature Verification**:
   - Verified `apps/web/src/app/api/webhooks/calcom/route.ts` parses signatures correctly against rotated secrets.
3. **Outbox Telegram Worker Verification**:
   - Verified `services/ai/app/jobs/outbox.py` and `token_alerts.py` gracefully handle credential changes with retry backoffs and logging.
4. **Local and CI Verification**:
   - All 802 automated tests pass with simulated rotated credentials in GitHub Actions workflows.
