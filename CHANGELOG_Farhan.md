# Changelog

## Unreleased - 2026-10-10

### Added

- Added a deterministic, pure-function estimator for web, automation, AI,
  scraping, and custom projects.
- Added estimator validation, pricing ranges, hour ranges, timelines, and
  assumptions.
- Added golden tests for standard, simple, and unknown-feature estimates.
- Added the FastAPI `POST /v1/estimate` endpoint with Pydantic request and
  response schemas.
- Added HMAC timestamp and signature verification for AI service requests.
- Added the Next.js `POST /api/estimate` proxy with server-side request
  signing.
- Added content document and vector chunk tables using pgvector.
- Added testable RAG content ingestion and chunking primitives.
- Added estimate API documentation.

### Validation

- `5 passed` from `services/ai/tests`.
- Python application modules compile successfully.
- Touched files have no editor diagnostics.
- `git diff --check` passes.

### Commit

These changes are ready to commit. No commit was created automatically.
Suggested commit message:

```text
Add estimator API and RAG ingestion foundation
```
