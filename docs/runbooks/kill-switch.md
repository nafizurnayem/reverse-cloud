# Runbook: AI Service Kill Switch

This runbook outlines how to immediately disable the AI chat assistant during an incident (e.g. prompt injection vulnerability, unexpected cost surge, upstream API outage, or unexpected hallucination).

---

## 1. When to Flip the Kill Switch

Activate the kill switch immediately if:
- **Excessive token consumption / cost anomaly**: AI token usage alert triggers critical threshold or rate of spend exceeds budget.
- **Security / prompt injection incident**: Malicious user manages to manipulate system prompt or extract internal context.
- **Provider outage**: OpenAI or embedding provider returns persistent 5xx or elevated latency (>30s per request).
- **Service degradation**: Web server or AI service reports high error rates or memory pressure.

---

## 2. Immediate Action (Emergency Shutdown)

### Method 1: Railway Dashboard (Recommended, zero downtime)

1. Open **Railway Dashboard → reverse-cloud-ai service → Variables**.
2. Change or add:
   ```env
   AI_ENABLED=false
   ```
3. Click **Redeploy / Save Changes**.
4. The service will restart with `ai_enabled: bool = False`.

### Method 2: Railway CLI (Fastest command line action)

```bash
railway variables --set "AI_ENABLED=false" --service "reverse-cloud-ai"
```

---

## 3. System Behavior While Kill Switch Is Active

When `AI_ENABLED=false`:
- Any incoming request to `POST /v1/chat` immediately yields an SSE event:
  ```json
  event: error
  data: {
    "code": "service_disabled",
    "message": "AI chat is temporarily disabled. Please reach us through the contact form."
  }
  ```
- No LLM API calls are made to OpenAI (zero additional cost incurred).
- The web application UI catches the `service_disabled` code and renders a prominent contact form button so users can reach staff directly.
- Estimator tool (`/v1/estimate`) and outbox notification processor continue running normally unless explicitly turned off.

---

## 4. Post-Incident Recovery & Verification

Once the incident is resolved:
1. Set variable back:
   ```bash
   railway variables --set "AI_ENABLED=true" --service "reverse-cloud-ai"
   ```
2. Verify AI service health:
   ```bash
   curl -i https://<AI_SERVICE_URL>/health
   # Returns {"status": "ok", "app_name": "Reverse Cloud AI service"}
   ```
3. Run guardrail test suite:
   ```bash
   pytest tests/security/test_guardrails.py
   ```
4. Verify chat endpoint response with test question.
