-- Insert new lead from AI chat or handoff
INSERT INTO public.leads (
    name,
    email,
    phone,
    company,
    preferred_locale,
    message,
    source,
    consent_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    now()
)
RETURNING id, created_at;
