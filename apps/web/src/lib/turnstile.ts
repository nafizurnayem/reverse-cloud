import "server-only";

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

type TurnstileOptions = {
  secret?: string;
  expectedHostname?: string;
  expectedAction?: string;
  fetcher?: typeof fetch;
  production?: boolean;
};

export async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
  options: TurnstileOptions = {},
) {
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token || token.length > 2048) {
    return { success: false, errors: [secret ? "missing-input-response" : "missing-secret"] };
  }

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  body.set("idempotency_key", crypto.randomUUID());
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await (options.fetcher ?? fetch)(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, cache: "no-store" },
    );
    if (!response.ok) return { success: false, errors: ["siteverify-unavailable"] };
    const result = await response.json() as TurnstileResponse;
    const hostname = options.expectedHostname ?? process.env.TURNSTILE_EXPECTED_HOSTNAME;
    const expectedAction = options.expectedAction ?? "contact";
    const production = options.production ?? process.env.NODE_ENV === "production";
    const actionMatches = result.action === expectedAction || (!production && !result.action);
    const valid = result.success === true
      && actionMatches
      && (!hostname || result.hostname === hostname);
    return { success: valid, errors: result["error-codes"] ?? [] };
  } catch {
    return { success: false, errors: ["siteverify-unavailable"] };
  }
}
