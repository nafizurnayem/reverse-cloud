export const clientStages = ["prospect", "active", "past"] as const;
export const clientSources = [
  "website",
  "fiverr",
  "upwork",
  "referral",
  "walk_in",
  "other",
] as const;

export type ClientStage = (typeof clientStages)[number];
export type ClientSource = (typeof clientSources)[number];

export const clientsPageSize = 25;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function nullable(input: string) {
  return input || null;
}

export function validClientId(input: string) {
  return uuidPattern.test(input);
}

export function validClientEmail(input: string) {
  return input.length <= 254 && emailPattern.test(input);
}

export function clientListPage(input: string | undefined) {
  if (!input || !/^\d+$/.test(input)) return 1;
  const page = Number(input);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function clientPayload(formData: FormData) {
  const fullName = value(formData, "full_name");
  // Client emails are normalized before writes; the database stores them as
  // citext so uniqueness and exact-email account linking stay case-insensitive.
  const email = value(formData, "email").toLowerCase();
  const phone = value(formData, "phone");
  const company = value(formData, "company");
  const country = value(formData, "country");
  const timezone = value(formData, "timezone");
  const preferredLocale = value(formData, "preferred_locale");
  const stage = value(formData, "stage");
  const source = value(formData, "source");
  const sourceRef = value(formData, "source_ref");

  if (
    !fullName
    || fullName.length > 200
    || (email && !validClientEmail(email))
    || phone.length > 40
    || company.length > 200
    || country.length > 100
    || timezone.length > 64
    || !["en", "bn"].includes(preferredLocale)
    || !clientStages.includes(stage as ClientStage)
    || !clientSources.includes(source as ClientSource)
    || sourceRef.length > 200
  ) {
    return null;
  }

  return {
    full_name: fullName,
    email: nullable(email),
    phone: nullable(phone),
    company: nullable(company),
    country: nullable(country),
    timezone: nullable(timezone),
    preferred_locale: preferredLocale,
    stage,
    source,
    source_ref: nullable(sourceRef),
  };
}
