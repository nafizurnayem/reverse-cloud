import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({ default: () => null }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => Object.assign((key: string) => key, { rich: () => "consent" }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: ReactNode }) => children }));

import { ContactForm } from "../src/components/contact-form";

describe("proposal contact form", () => {
  it("keeps the chosen service and pre-fills account details for review", () => {
    const html = renderToStaticMarkup(createElement(ContactForm, {
      services: [{ id: "service-1", name: "Website Development" }],
      siteKey: "test-key",
      selectedServiceId: "service-1",
      initialName: "New Client",
      initialEmail: "client@example.com",
      proposalMode: true,
    }));

    expect(html).toContain('name="name"');
    expect(html).toContain('value="New Client"');
    expect(html).toContain('value="client@example.com"');
    expect(html).toContain('<option value="service-1" selected="">Website Development</option>');
    expect(html).toContain("proposalSubmit");
  });

  it("keeps general enquiries optional for service selection", () => {
    const html = renderToStaticMarkup(createElement(ContactForm, {
      services: [{ id: "service-1", name: "Website Development" }],
      siteKey: "test-key",
    }));

    expect(html).toContain('<select name="service_id">');
    expect(html).toContain("submit");
  });
});
