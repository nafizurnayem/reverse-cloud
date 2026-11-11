import type { Locale } from "@/lib/auth/routes";

const inviteTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function validInviteToken(value: string | readonly string[] | null | undefined) {
  return typeof value === "string" && inviteTokenPattern.test(value) ? value : null;
}

export function acceptInvitePath(locale: Locale, token: string) {
  void locale;
  return `/accept-invite?${new URLSearchParams({ token })}`;
}

export function inviteTokenFromDestination(destination: string, _locale: Locale) {
  void _locale;
  try {
    const parsed = new URL(destination, "https://internal.invalid");
    if (
      parsed.origin !== "https://internal.invalid"
      || parsed.pathname.replace(/\/$/, "") !== "/accept-invite"
    ) {
      return null;
    }
    return validInviteToken(parsed.searchParams.get("token"));
  } catch {
    return null;
  }
}
