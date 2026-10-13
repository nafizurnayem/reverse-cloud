import { describe, expect, it } from "vitest";
import { needsClientAccountLink, safePostLoginPath } from "../src/lib/auth/routes";

describe("post-login destination validation", () => {
  it.each([
    ["/en/admin", "en", "/en/admin"],
    ["/bn/portal/projects/1?tab=files#invoice", "bn", "/bn/portal/projects/1?tab=files#invoice"],
    [undefined, "en", "/en/portal"],
    ["https://evil.example/en/admin", "en", "/en/portal"],
    ["//evil.example/en/admin", "en", "/en/portal"],
    ["/\\evil.example/en/admin", "en", "/en/portal"],
    ["/en/%5cevil.example", "en", "/en/portal"],
    ["/bn/admin", "en", "/en/portal"],
    ["/en.evil/admin", "en", "/en/portal"],
    ["/en/../bn/admin", "en", "/en/portal"],
    ["/en/login", "en", "/en/portal"],
    [["/en/admin"], "en", "/en/portal"],
  ] as const)("maps %j for %s to %s", (value, locale, expected) => {
    expect(safePostLoginPath(value, locale)).toBe(expected);
  });
});

describe("client account linking destinations", () => {
  it("links portal sign-ins without creating client records for admin or invitation callbacks", () => {
    expect(needsClientAccountLink("/en/portal", "en")).toBe(true);
    expect(needsClientAccountLink("/bn/portal/projects/1?tab=files", "bn")).toBe(true);
    expect(needsClientAccountLink("/en/admin", "en")).toBe(false);
    expect(needsClientAccountLink("/en/accept-invite?token=secret", "en")).toBe(false);
    expect(needsClientAccountLink("/bn/portal", "en")).toBe(false);
  });
});
