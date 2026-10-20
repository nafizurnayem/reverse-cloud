-- Insert booking proposal hold for AI scheduling tool
INSERT INTO public.booking_proposals (
    session_id,
    meeting_type_id,
    starts_at,
    ends_at,
    timezone,
    intake_summary
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING id, session_id, meeting_type_id, starts_at, ends_at, timezone, expires_at, status;
