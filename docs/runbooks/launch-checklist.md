# §13 Pre-Launch & Go-Live Verification Checklist

This document contains the final pre-launch verification checklist (§13) for Reverse Cloud. Review each item with the engineering and operations team before flipping the production DNS.

---

## 1. Security & Access Control

- [x] **Row-Level Security (RLS)**: Enabled and verified on all 25 tables (`rls_guard.test.sql` passes).
- [x] **Cross-Client Isolation**: Client users cannot read or update another client’s projects, milestones, payments, or meetings.
- [x] **Least-Privilege Roles**: `ai_service` role restricted to outbox processing and chat operations; no direct table writes from browser anon key.
- [x] **Authentication & Cookie Security**: `CHAT_COOKIE_SECRET` configured; HttpOnly, Secure, SameSite cookies enforced.
- [x] **Bot & Abuse Protection**: Cloudflare Turnstile verification active on public leads and estimator forms; Upstash Redis rate limiting active.
- [x] **Guardrails & Kill Switch**: Prompt injection detection active; emergency kill switch documented and tested (`AI_ENABLED=false`).

---

## 2. Integrations & Third-Party APIs

- [x] **Cal.com**: Webhook URL configured (`https://reversecloud.dev/api/webhooks/calcom`), HMAC signature verification validated with `CALCOM_WEBHOOK_SECRET`.
- [x] **Resend (Email)**: `EMAIL_API_KEY` and `EMAIL_FROM` active for transactional notifications, client invitations, and payment due reminders.
- [x] **Telegram Bot**: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set up for operational alerts (terminal outbox failures, daily token budget alerts).
- [x] **Google OAuth**: Client ID and secret configured in Supabase Auth with authorized redirect URIs.
- [x] **Storage**: Private `invoices` storage bucket verified with 10MB file limit and MIME type restriction (`application/pdf`).

---

## 3. Database & Operations

- [x] **All Migrations Applied**: 25 migrations (`0001` through `0025`) synchronized on Supabase dev/production.
- [x] **Nightly Cron Jobs**: `nightly_maintenance` pg_cron job scheduled (marking overdue payments, queueing reminder emails).
- [x] **Health Check Endpoints**:
  - Web: `/api/health` (DB probe, latency, uptime)
  - AI Service: `/health` (service readiness)
- [x] **Runbooks Published**:
  - `docs/runbooks/restore-backup.md` (backup restore drill)
  - `docs/runbooks/kill-switch.md` (emergency AI kill switch)
  - `docs/runbooks/contact-leads.md` (leads and outbox delivery)

---

## 4. Test Suite Quality Gate

- [x] **Database (pgTAP)**: 491 / 491 tests pass (20 suites).
- [x] **Web Application (Vitest)**: 148 / 148 tests pass (24 suites).
- [x] **AI Service (Pytest)**: 61 / 61 tests pass (10 suites).
- [x] **Next.js Production Build**: 94 / 94 static/dynamic routes compiled and optimized without type errors.
- [x] **Total Automated Tests**: 700 / 700 passing (100%).

---

## 5. Final Launch Steps (Team Action)

1. [ ] Set up external uptime pinger (BetterStack / UptimeRobot) pinging `/api/health` every 60s.
2. [ ] Verify custom domain SSL certificate (`reversecloud.io` / `reversecloud.dev`).
3. [ ] Perform one live test booking via Cal.com and verify appearance in client portal meetings.
4. [ ] Perform one live contact form enquiry submission and verify email + Telegram notification.
5. [ ] Confirm staff admin logins and permission assignments.
