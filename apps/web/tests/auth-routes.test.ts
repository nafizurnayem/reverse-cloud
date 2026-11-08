import { describe, expect, it } from "vitest";
import {
  localizedPath,
  needsClientAccountLink,
  postLoginPathFromQuery,
  protectedArea,
  safePostLoginPath,
} from "../src/lib/auth/routes";

describe("post-login destination validation", () => {
  it.each([
    ["/en/admin", "en", "/admin"],
    ["/bn/project_manager/projects?tab=active", "en", "/project_manager/projects?tab=active"],
    ["/developer", "bn", "/developer"],
    ["/bn/portal/projects/1?tab=files#invoice", "bn", "/bn/portal/projects/1?tab=files#invoice"],
    [undefined, "en", "/en"],
    ["https://evil.example/en/admin", "en", "/en"],
    ["//evil.example/en/admin", "en", "/en"],
    ["/\\evil.example/en/admin", "en", "/en"],
    ["/en/%5cevil.example", "en", "/en"],
    ["/bn/admin", "en", "/admin"],
    ["/en.evil/admin", "en", "/en"],
    ["/en/../bn/admin", "en", "/en"],
    ["/en/login", "en", "/en"],
    [["/en/admin"], "en", "/en"],
  ] as const)("maps %j for %s to %s", (value, locale, expected) => {
    expect(safePostLoginPath(value, locale)).toBe(expected);
  });
});

describe("staff dashboard routes", () => {
  it.each(["/admin", "/developer/projects", "/bn/project_manager/payments"])(
    "treats %s as a protected staff route",
    (path) => expect(protectedArea(path)).toBe("admin"),
  );

  it("keeps staff return paths free of locale prefixes", () => {
    expect(localizedPath("/developer/projects", "bn")).toBe("/developer/projects");
    expect(localizedPath("/bn/project_manager", "bn")).toBe("/project_manager");
  });
});

describe("postLoginPathFromQuery", () => {
  it("uses returnTo only as a legacy fallback when next is absent", () => {
    expect(postLoginPathFromQuery(undefined, "/en/schedule?slot=1", "en"))
      .toBe("/en/schedule?slot=1");
    expect(postLoginPathFromQuery("/en/portal", "/en/schedule", "en"))
      .toBe("/en/portal");
  });

  it("applies the same open-redirect protection to returnTo", () => {
    expect(postLoginPathFromQuery(undefined, "https://evil.example", "en"))
      .toBe("/en");
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
