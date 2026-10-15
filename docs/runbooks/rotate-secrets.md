# Rotate secrets

Record the operator, environment, start time and verification result in the
private operations log. Never paste values into commits, tickets or logs.

- **AI HMAC and Cal.com webhook:** put the replacement in `*_CURRENT`, move the
  old value to `*_PREVIOUS`, deploy both consumers, switch the provider, test,
  then remove `*_PREVIOUS`.
- **Cal.com API key:** create a new key, deploy it, verify both meeting types,
  then revoke the old key.
- **Supabase service role:** rotate in Supabase, update all server deployments
  and workers immediately, then verify auth refresh, contact leads, admin and
  webhook processing.
- **Chat cookie and rate-limit salt:** deploy new random values to all web
  instances together. Existing anonymous chat cookies may require Turnstile
  again.
- **Turnstile, Upstash, email and Telegram:** create replacements, deploy, run a
  controlled verification, then revoke the old credentials.

If verification fails, restore the previous value while it remains valid and
investigate. For confirmed exposure, disable the compromised value first when
that risk is greater than temporary downtime.
