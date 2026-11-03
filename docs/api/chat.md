# Chat API Contract

The browser calls `POST /api/chat`. The Next.js route validates the request,
owns the conversation ID in a signed cookie, signs the normalized JSON body and
proxies it to the AI service at `POST /v1/chat`.

## Request

```json
{
  "messages": [
    { "role": "user", "content": "I need help with my project." },
    { "role": "assistant", "content": "Sure, tell me more." }
  ],
  "locale": "en"
}
```

`messages` contains one to 50 `user` or `assistant` messages. Each message is
limited to 12,000 characters. `locale` is `en` or `bn` and defaults to `en`.
The browser must not own `conversation_id`. The web proxy generates it and stores
it in the `HttpOnly`, signed `rc_chat_session` cookie for 24 hours. The direct AI
service contract still accepts `conversation_id` and echoes it in the first event.

The browser must not send or choose `client_id`. For a signed-in user, the web
route resolves the matching client record through the user's authenticated
Supabase session and adds that ID to the HMAC-signed upstream body. Signed-out
visitors and users without a linked client record send no `client_id`. The AI
service must treat this signed field as the only client identity for client-scoped
tools.

The first request for a new or expired chat session must include a successful
Cloudflare Turnstile token in `X-Turnstile-Token`. Configure the widget with the
`chat` action. Later requests with the valid signed cookie do not repeat the
challenge. A tampered cookie starts a new session and requires a new challenge.

The proxy permits 20 requests per minute per signed chat session and 60 requests
per minute per client IP across sessions. Both identities are HMAC-hashed before
they are used as Upstash keys. It returns `429` with `Retry-After`, standard
`X-RateLimit-*`, and scope-specific `X-RateLimit-IP-*` and
`X-RateLimit-Session-*` headers when either limit is exceeded. Production
deployments require Upstash Redis; local development uses the in-process fallback.

Conversation history is client-managed. The complete history needed for a turn
must be sent in every request; the AI service does not persist chat sessions.

## SSE response

The successful response uses `Content-Type: text/event-stream`:

```text
event: message_start
data: {"conversation_id":"optional-client-id"}

event: text_delta
data: {"text":" response text "}

event: message_end
data: {"reason":"stop"}
```

Multiple `text_delta` events may be sent. If the provider fails after streaming
starts, the service sends this event instead of `message_end`:

```text
event: error
data: {"code":"provider_error","message":"..."}
```

Before streaming starts, service or authentication failures use JSON:

```json
{ "detail": "chat service is not configured" }
```

The web proxy uses `400` for invalid JSON or messages, `403` for missing or failed
Turnstile verification, `413` for an oversized request, `429` for rate limiting,
`503` for missing protection/service configuration, `502` for an unavailable AI
service, and `504` when FastAPI does not start a response before the configured
timeout. A browser disconnect aborts the upstream request. Once FastAPI starts
the response, the proxy forwards its SSE stream without buffering or imposing a
whole-stream timeout. Other upstream status codes are forwarded unchanged.

## Web configuration

Configure these server-only variables in `apps/web/.env.local` and in the web
deployment environment:

```dotenv
AI_SERVICE_URL=
AI_HMAC_SECRET_CURRENT=
AI_CHAT_CONNECT_TIMEOUT_MS=10000
CHAT_COOKIE_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RATE_LIMIT_SALT=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
TURNSTILE_EXPECTED_HOSTNAME=
```

`CHAT_COOKIE_SECRET` must contain at least 32 random bytes. The HMAC secret must
match `AI_HMAC_SECRET_CURRENT` on the AI service. The connect timeout accepts
values from 1,000 through 30,000 milliseconds and defaults to 10,000.

## Local Ollama with RAG

The AI service uses Ollama for chat and embeddings when `OLLAMA_URL` is set.
The small multilingual embedding model matches the 1024-dimensional pgvector
schema introduced in migration `0035_ollama_rag_embeddings.sql`:

```dotenv
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:1b
EMBEDDING_MODEL=qwen3-embedding:0.6b
EMBED_DIM=1024
DATABASE_URL_AI=postgresql://ai_service:<password>@<host>:5432/postgres?sslmode=require
```

Pull both models before starting the AI service, apply the migration, then
rebuild the preserved knowledge chunks without creating duplicate documents:

```bash
python -m scripts.reindex_knowledge
```
