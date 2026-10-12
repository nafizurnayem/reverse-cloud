import { describe, expect, it } from "vitest";
import { validateLeadPayload } from "../src/lib/leads/values";

const valid = {
  name: "  Nafiz  ",
  email: " NAFIZ@example.com ",
  phone: "",
  company: "Reverse Cloud",
  country: "Bangladesh",
  locale: "bn",
  message: "I need a website for my company.",
  serviceId: "00000000-0000-4000-8000-000000000001",
  consent: true,
  turnstileToken: "token",
  utm: { utm_source: "newsletter", ignored: "value" },
};

describe("contact lead validation", () => {
  it("normalizes a valid bilingual contact submission", () => {
    const result = validateLeadPayload(valid);
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Nafiz",
        email: "nafiz@example.com",
        phone: "",
        company: "Reverse Cloud",
        country: "Bangladesh",
        locale: "bn",
        message: "I need a website for my company.",
        serviceId: "00000000-0000-4000-8000-000000000001",
        consent: true,
        turnstileToken: "token",
        utm: { utm_source: "newsletter" },
      },
    });
  });

  it("requires a contact method, consent and a Turnstile token", () => {
    expect(validateLeadPayload({ ...valid, email: "", phone: "" })).toMatchObject({ code: "contact_required" });
    expect(validateLeadPayload({ ...valid, consent: false })).toMatchObject({ code: "consent_required" });
    expect(validateLeadPayload({ ...valid, turnstileToken: "" })).toMatchObject({ code: "turnstile_required" });
  });

  it("rejects malformed contact details and service IDs", () => {
    expect(validateLeadPayload({ ...valid, email: "not-an-email" })).toMatchObject({ code: "invalid_input" });
    expect(validateLeadPayload({ ...valid, serviceId: "wrong" })).toMatchObject({ code: "invalid_input" });
  });

  it("silently identifies submissions that fill the honeypot", () => {
    expect(validateLeadPayload({ ...valid, website: "spam.example" })).toEqual({ ok: false, code: "spam" });
  });
});

