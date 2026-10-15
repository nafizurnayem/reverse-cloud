# Cal.com setup

Member D first confirms that the account plan supports API v2 and signed
webhooks. Keep all credentials server-only.

1. Create **Discovery Call** (30 minutes) and **Technical Consult** (45
   minutes). Assign the production host/team, meeting location, 24-hour minimum
   notice, a 15-minute post-meeting buffer, `Asia/Dhaka` availability, and the
   host's connected calendar.
2. Copy each numeric event type ID into `meeting_types.calcom_event_type_id` for
   `discovery_call` and `technical_consult`.
3. Set `CALCOM_API_KEY` and a random 32-byte
   `CALCOM_WEBHOOK_SECRET_CURRENT` in `apps/web/.env.local` and the deployment.
4. Register `https://<web-host>/api/webhooks/calcom` for `BOOKING_CREATED`,
   `BOOKING_CONFIRMED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`,
   `BOOKING_REJECTED`, and no-show events. Use the same webhook secret and the
   default payload.
5. Apply migrations `0025_meetings.sql` and
   `0026_calcom_webhook_processing.sql` in order.

Verify both meeting types through `/v1/schedule/slots`. Create a test booking
with `bookingProposalId` metadata, confirm one meeting and one delivery row are
created, replay the same event and confirm `duplicate: true`, then cancel it and
confirm the meeting becomes `cancelled`.
