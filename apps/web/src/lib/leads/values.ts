export type LeadPayload = {
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  locale: "en" | "bn";
  message: string;
  serviceId: string | null;
  consent: true;
  turnstileToken: string;
  utm: Record<string, string>;
};

export type LeadValidationResult =
  | { ok: true; data: LeadPayload }
  | { ok: false; code: "invalid_input" | "contact_required" | "consent_required" | "turnstile_required" | "spam" };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+0-9().\s-]{7,40}$/;
const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function validateLeadPayload(value: unknown): LeadValidationResult {
  const input = object(value);
  if (!input) return { ok: false, code: "invalid_input" };
  if (clean(input.website, 200)) return { ok: false, code: "spam" };

  const name = clean(input.name, 120);
  const email = clean(input.email, 320).toLowerCase();
  const phone = clean(input.phone, 40);
  const company = clean(input.company, 120);
  const country = clean(input.country, 80);
  const message = clean(input.message, 5000);
  const turnstileToken = clean(input.turnstileToken, 2048);
  const locale = input.locale === "bn" ? "bn" : "en";
  const serviceValue = clean(input.serviceId, 36);
  const serviceId = serviceValue && uuidPattern.test(serviceValue) ? serviceValue : null;

  if (name.length < 2 || message.length < 10) return { ok: false, code: "invalid_input" };
  if (!email && !phone) return { ok: false, code: "contact_required" };
  if ((email && !emailPattern.test(email)) || (phone && !phonePattern.test(phone))) {
    return { ok: false, code: "invalid_input" };
  }
  if (input.consent !== true) return { ok: false, code: "consent_required" };
  if (!turnstileToken) return { ok: false, code: "turnstile_required" };
  if (serviceValue && !serviceId) return { ok: false, code: "invalid_input" };

  const rawUtm = object(input.utm) ?? {};
  const utm = Object.fromEntries(
    utmKeys
      .map((key) => [key, clean(rawUtm[key], 200)] as const)
      .filter(([, item]) => Boolean(item)),
  );

  return {
    ok: true,
    data: { name, email, phone, company, country, locale, message, serviceId, consent: true, turnstileToken, utm },
  };
}

