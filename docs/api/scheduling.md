# Scheduling API

`GET /api/schedule/slots` and `GET /v1/schedule/slots` expose the same
read-only Cal.com availability proxy. Required parameters are `meetingType`,
`start`, and `end`; `timeZone` defaults to `UTC`. Ranges must be valid ISO 8601,
must start in the future, and cannot exceed 31 days.

The route resolves an active `meeting_types` row, keeps the Cal.com key on the
server, rate-limits by hashed IP, requests Cal.com v2 with `format=range`, and
returns normalized UTC `{start, end}` values.

`POST /api/webhooks/calcom` verifies `X-Cal-Signature-256` against the raw body,
limits requests to 256 KiB, and uses the atomic
`process_calcom_webhook_delivery` RPC. Migration `0026` stores a PII-free
delivery ledger, rejects duplicate deliveries, protects newer meeting state
from older events, and links D's `meetings` rows to proposals, clients and
leads. Invalid signatures return 401 and transient processing failures return
503 so Cal.com can retry.
