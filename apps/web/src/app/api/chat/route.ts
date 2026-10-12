import { createHmac } from "node:crypto";

export async function POST(request: Request) {
  const serviceUrl = process.env.AI_SERVICE_URL;
  const secret = process.env.AI_HMAC_SECRET_CURRENT;
  if (!serviceUrl || !secret) {
    return Response.json({ error: "Chat service is not configured" }, { status: 503 });
  }

  const body = await request.text();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  let response: Response;
  try {
    response = await fetch(`${serviceUrl.replace(/\/$/, "")}/v1/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ai-timestamp": timestamp,
        "x-ai-signature": signature,
      },
      body,
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "Chat service unavailable" }, { status: 502 });
  }

  if (!response.body) {
    return Response.json({ error: "Chat service returned an empty response" }, { status: 502 });
  }
  return new Response(response.body, {
    status: response.status,
    headers: {
      "cache-control": "no-cache",
      "content-type": response.headers.get("content-type") ?? "text/event-stream",
    },
  });
}
