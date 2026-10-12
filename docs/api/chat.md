# Chat API Contract

The browser calls `POST /api/chat`. The Next.js route signs the unchanged JSON
body and proxies it to the AI service at `POST /v1/chat`.

## Request

```json
{
  "messages": [
    { "role": "user", "content": "I need help with my project." },
    { "role": "assistant", "content": "Sure, tell me more." }
  ],
  "locale": "en",
  "conversation_id": "optional-client-id"
}
```

`messages` contains one to 50 `user` or `assistant` messages. Each message is
limited to 12,000 characters. `locale` is `en` or `bn` and defaults to `en`.
`conversation_id` is optional and is echoed in the first event.

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

The web proxy uses `503` for missing configuration, `502` for an unavailable
AI service, and forwards other upstream status codes unchanged.