# Runbook: Branch Protection & CI Quality Gates

This runbook documents the required branch protection rules, automated CI status checks, and merge policies enforced on the `reverse-cloud` repository (Wave 3 deliverable).

---

## 1. Protected Branches

The following branches MUST be protected under GitHub Repository Settings (**Settings → Branches → Branch protection rules**):
- `main` (Production release branch)
- `Dev` (Integration / staging development branch)

---

## 2. Required Status Checks

To ensure that no broken migrations, failing unit tests, or build compilation errors can be merged into `Dev` or `main`, pull requests MUST pass the three CI workflows before the **Merge** button is enabled:

| Check Name | Workflow File | What It Validates |
|------------|---------------|-------------------|
| **`Database / Migrations and access-rule tests`** | [`.github/workflows/db.yml`](../../.github/workflows/db.yml) | Runs `supabase start` on clean Docker, applies all migrations (`0001`–`0028`), and executes 536 pgTAP tests (`supabase test db`). |
| **`Web Application / Lint, typecheck, vitest & build`** | [`.github/workflows/web.yml`](../../.github/workflows/web.yml) | Runs ESLint (`--max-warnings=0`), TypeScript `tsc --noEmit`, 205 Vitest tests, and Next.js production build (`pnpm build`). |
| **`AI Service / Pytest suite`** | [`.github/workflows/ai.yml`](../../.github/workflows/ai.yml) | Runs 61 Pytest tests across guardrails, estimators, evals, outbox delivery, and token alert monitoring. |

---

## 3. GitHub Branch Protection Policy Configuration

Apply the following settings on both `Dev` and `main`:

1. **Require a pull request before merging**:
   - [x] Require approvals: **1 approval**
   - [x] Dismiss stale pull request approvals when new commits are pushed
   - [x] Require review from Code Owners (per `.github/CODEOWNERS`)
2. **Require status checks to pass before merging**:
   - [x] Require branches to be up to date before merging (**Strict**)
   - Required checks:
     - `Migrations and access-rule tests`
     - `Lint, typecheck, vitest & build`
     - `Pytest suite`
3. **Require conversation resolution before merging**:
   - [x] All PR review comments and discussions must be resolved.
4. **Require signed commits**:
   - [x] Enforce GPG / SSH verified commits.
5. **Do not allow bypassing the above settings**:
   - [x] Enforce restrictions for administrators.

---

## 4. Automated Dependency Maintenance (Renovate)

- Configuration: [`renovate.json`](../../renovate.json)
- Schedule: Weekly on Monday mornings (before 06:00 Asia/Dhaka).
- Policy:
  - Non-major dependencies are bundled into automated group PRs.
  - Major dependency upgrades trigger individual PRs with breaking-change warnings.
  - Supabase CLI is pinned to `v2.120.0` until the upstream Windows x64 binary bug in `2.121.0` is resolved.
