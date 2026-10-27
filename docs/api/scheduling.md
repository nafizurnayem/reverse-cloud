# Scheduling API

`GET /api/schedule/slots` and `GET /v1/schedule/slots` expose the same
read-only Cal.com availability proxy. Required parameters are `meetingType`,
`start`, and `end`; `timeZone` defaults to `UTC`. Ranges must be valid ISO 8601,
must start in the future, and cannot exceed 31 days.

The route resolves an active `meeting_types` row, keeps the Cal.com key on the
server, rate-limits by hashed IP, requests Cal.com v2 with `format=range`, and
returns normalized UTC `{start, end}` values.

`POST /api/schedule/book` is the public schedule-page booking contract. It
accepts `meetingType`, `start`, `end`, `timeZone`, `name`, `email`, optional
`company` and `notes`, `locale`, and a Turnstile token issued for the
`schedule_booking` action. The route validates the payload, limits each IP to
five booking attempts per hour, rechecks that the exact slot is still live,
and creates the Cal.com booking server-side. A successful response is:

```json
{
  "ok": true,
  "booking": {
    "uid": "calcom-booking-uid",
    "startsAt": "2027-01-10T10:00:00.000Z",
    "endsAt": "2027-01-10T10:30:00.000Z",
    "meetingUrl": "https://cal.com/video/example"
  }
}
```

`POST /api/chat/confirm-booking` requires an authenticated user and accepts a
single `proposalId`. It atomically claims the proposal through
`confirm_booking_proposal`, creates the real Cal.com booking, and returns the
same `booking` object plus `proposalId` and `status: "confirmed"`. Both routes
return `slot_unavailable` with HTTP 409 when the selected slot can no longer be
booked. They never return success before Cal.com supplies a booking UID.

`POST /api/webhooks/calcom` verifies `X-Cal-Signature-256` against the raw body,
limits requests to 256 KiB, and uses the atomic
`process_calcom_webhook_delivery` RPC. Migration `0026` stores a PII-free
delivery ledger, rejects duplicate deliveries, protects newer meeting state
from older events, and links D's `meetings` rows to proposals, clients and
leads. Invalid signatures return 401 and transient processing failures return
503 so Cal.com can retry.
