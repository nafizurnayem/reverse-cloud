import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { signInWithGoogle, signInWithMagicLink, signOut } from "../src/app/[locale]/(auth)/actions";
import { GET } from "../src/app/[locale]/(auth)/auth/callback/route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reverse-cloud.example/app/path");
  mocks.createClient.mockResolvedValue({
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithOtp: mocks.signInWithOtp,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      signOut: mocks.signOut,
    },
  });
  mocks.signInWithOAuth.mockResolvedValue({
    data: { url: "https://project.supabase.co/auth/v1/authorize" },
    error: null,
  });
  mocks.signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("magic-link start", () => {
  it("normalizes the email and preserves the selected locale and safe destination", async () => {
    const formData = new FormData();
    formData.set("email", "  Person@Example.COM ");

    await expect(signInWithMagicLink("bn", "/bn/portal/projects?tab=active", formData)).rejects.toThrow(
      "redirect:/bn/login?magic_link_sent=1&next=%2Fbn%2Fportal%2Fprojects%3Ftab%3Dactive",
    );
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: {
        emailRedirectTo: "https://reverse-cloud.example/bn/auth/callback?method=magic_link&next=%2Fbn%2Fportal%2Fprojects%3Ftab%3Dactive",
        shouldCreateUser: true,
      },
    });
  });

  it("rejects invalid email without calling Supabase", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");

    await expect(signInWithMagicLink("en", "/en/admin", formData)).rejects.toThrow(
      "redirect:/en/login?error=invalid_email&next=%2Fen%2Fadmin",
    );
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("rejects external destinations and reports provider failures safely", async () => {
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: new Error("rate limited") });
    const formData = new FormData();
    formData.set("email", "person@example.com");

    await expect(signInWithMagicLink("en", "https://evil.example", formData)).rejects.toThrow(
      "redirect:/en/login?error=magic_link_start_failed&next=%2Fen%2Fportal",
    );
  });
});

describe("Google OAuth start", () => {
  it("uses the selected locale and safe destination in redirectTo", async () => {
    await expect(signInWithGoogle("bn", "/bn/admin?tab=staff")).rejects.toThrow(
      "redirect:https://project.supabase.co/auth/v1/authorize",
    );
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://reverse-cloud.example/bn/auth/callback?next=%2Fbn%2Fadmin%3Ftab%3Dstaff",
        skipBrowserRedirect: true,
      },
    });
  });

  it("rejects an external post-login destination", async () => {
    await expect(signInWithGoogle("en", "https://evil.example")).rejects.toThrow(
      "redirect:https://project.supabase.co/auth/v1/authorize",
    );
    const call = mocks.signInWithOAuth.mock.calls[0][0];
    expect(new URL(call.options.redirectTo).searchParams.get("next")).toBe("/en/portal");
  });

  it("returns a localized stable error when OAuth cannot start", async () => {
    mocks.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: new Error("provider disabled") });
    await expect(signInWithGoogle("bn", "/bn/portal")).rejects.toThrow(
      "redirect:/bn/login?error=oauth_start_failed&next=%2Fbn%2Fportal",
    );
  });
});

describe("OAuth callback", () => {
  const context = (locale: string) => ({ params: Promise.resolve({ locale }) });

  it("exchanges the code and redirects without caching", async () => {
    const response = await GET(
      new NextRequest("https://reverse-cloud.example/bn/auth/callback?code=once&next=%2Fbn%2Fadmin"),
      context("bn"),
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("once");
    expect(response.headers.get("location")).toBe("https://reverse-cloud.example/bn/admin");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("does not exchange a provider error and preserves the locale", async () => {
    const response = await GET(
      new NextRequest("https://reverse-cloud.example/en/auth/callback?error=access_denied&next=%2Fen%2Fadmin"),
      context("en"),
    );
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(new URL(response.headers.get("location")!).pathname).toBe("/en/login");
    expect(new URL(response.headers.get("location")!).searchParams.get("error")).toBe("oauth_denied");
  });

  it("rejects missing codes, failed exchanges, and cross-locale destinations", async () => {
    let response = await GET(
      new NextRequest("https://reverse-cloud.example/bn/auth/callback?next=https://evil.example"),
      context("bn"),
    );
    expect(new URL(response.headers.get("location")!).searchParams.get("error")).toBe("invalid_callback");

    mocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: new Error("expired") });
    response = await GET(
      new NextRequest("https://reverse-cloud.example/bn/auth/callback?code=expired&next=%2Fen%2Fadmin"),
      context("bn"),
    );
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/bn/login");
    expect(destination.searchParams.get("next")).toBe("/bn/portal");
  });

  it("returns a magic-link-specific error for an expired email link", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: new Error("expired") });
    const response = await GET(
      new NextRequest(
        "https://reverse-cloud.example/bn/auth/callback?method=magic_link&code=expired&next=%2Fbn%2Fportal",
      ),
      context("bn"),
    );
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/bn/login");
    expect(destination.searchParams.get("error")).toBe("magic_link_invalid");
    expect(destination.searchParams.get("next")).toBe("/bn/portal");
  });
});

describe("logout", () => {
  it("clears only the current session and preserves the locale", async () => {
    await expect(signOut("bn")).rejects.toThrow("redirect:/bn/login?logged_out=1");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("shows a stable error when sign-out fails", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("network") });
    await expect(signOut("en")).rejects.toThrow("redirect:/en/login?error=sign_out_failed");
  });
});
