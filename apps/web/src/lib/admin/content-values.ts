export type ContentErrorKey =
  | "duplicateSlug"
  | "publishNeedsEnglish"
  | "portfolioNeedsConsent"
  | "invalidJson"
  | "invalidFile"
  | "invalidInput"
  | "saveFailed";

export function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalText(formData: FormData, key: string) {
  return text(formData, key) || null;
}

export function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export function integer(formData: FormData, key: string, fallback = 0) {
  const value = Number.parseInt(text(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

export function decimal(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function stringList(formData: FormData, key: string) {
  return text(formData, key)
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function stringValues(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseJson(value: string): unknown {
  return JSON.parse(value);
}

export function contentErrorKey(error: { code?: string; message?: string } | null) {
  if (!error) return "saveFailed" satisfies ContentErrorKey;
  if (error.code === "23505") return "duplicateSlug" satisfies ContentErrorKey;
  if (error.code === "23514") {
    if (error.message?.includes("portfolio_publish_needs_consent")) {
      return "portfolioNeedsConsent" satisfies ContentErrorKey;
    }
    if (
      error.message?.includes("services_publish_needs_english") ||
      error.message?.includes("blog_publish_needs_english") ||
      error.message?.includes("portfolio_publish_needs_english")
    ) {
      return "publishNeedsEnglish" satisfies ContentErrorKey;
    }
  }
  return "saveFailed" satisfies ContentErrorKey;
}
