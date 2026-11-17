import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  directPublicKnowledgeReply,
  directServiceDiscoveryReply,
  isServiceDiscoveryFollowUp,
  isServiceDiscoveryRequest,
  relevantServiceReply,
  retrievePublicKnowledge,
} from "../src/lib/chat/public-knowledge";
import { SERVICES_CATALOG } from "../src/lib/services-catalog";

describe("temporary public-site retrieval", () => {
  it("starts a service discovery conversation instead of refusing the request", () => {
    expect(isServiceDiscoveryRequest("help me to find a service")).toBe(true);
    expect(isServiceDiscoveryRequest("I need help choosing a service")).toBe(true);
    expect(directServiceDiscoveryReply("en")).toContain("what you want to build");
  });

  it("matches a follow-up project description to a service and returns its details", () => {
    const messages = [
      { role: "user" as const, content: "help me to find a service" },
      { role: "assistant" as const, content: directServiceDiscoveryReply("en") },
      { role: "user" as const, content: "I need a service for a fast bilingual website with a CMS" },
    ];

    expect(isServiceDiscoveryFollowUp(messages)).toBe(true);
    expect(isServiceDiscoveryFollowUp([
      ...messages,
      { role: "assistant", content: "Website Development is the best fit." },
      { role: "user", content: "Book a meeting" },
    ])).toBe(false);
    const reply = relevantServiceReply(messages.at(-1)!.content, "en");
    expect(reply).toContain("Website Development");
    expect(reply).toContain("/services/website-development");
  });

  it.each(["services", "Services?", "your services please", "Show all services", "I want to book a service"])(
    "lists every service and asks for a booking choice for %s",
    (query) => {
      const reply = directPublicKnowledgeReply(query, "en");
      for (const service of SERVICES_CATALOG) expect(reply).toContain(`• ${service.name_en}\n`);
      expect(reply?.split("\n").filter((line) => line.startsWith("• "))).toHaveLength(SERVICES_CATALOG.length);
      expect(reply).toMatch(/Which service would you like to book\?$/);
    },
  );

  it.each(["সেবা", "সার্ভিস", "আপনাদের সেবাগুলো", "সব সেবা", "services"])(
    "lists every service in Bengali for %s",
    (query) => {
      const reply = directPublicKnowledgeReply(query, "bn");
      for (const service of SERVICES_CATALOG) expect(reply).toContain(`• ${service.name_bn}\n`);
      expect(reply).toMatch(/আপনি কোন সেবাটি বুক করতে চান\?$/);
    },
  );

  it.each([
    "Tell me about AdSense services",
    "Book Website Development",
    "Book AI Chatbots & Agents services",
    "Tell me about marketing services",
    "What is the weather?",
  ])("preserves specific service and other requests for %s", (query) => {
    expect(directPublicKnowledgeReply(query, "en")).toBeNull();
  });

  it("uses the supplied published catalog in its display order", () => {
    const reply = directPublicKnowledgeReply("services", "en", [
      { name_en: "Custom Integration", name_bn: "কাস্টম ইন্টিগ্রেশন", sort_order: 20 },
      { name_en: "Cloud Support", name_bn: "ক্লাউড সাপোর্ট", sort_order: 10 },
    ]);
    expect(reply).toBe("Our services\n\n• Cloud Support\n• Custom Integration\n\nWhich service would you like to book?");
  });

  it("retrieves a cited service price for an English question", () => {
    const excerpt = retrievePublicKnowledge("What is the starting price for Website Development?", "en");
    expect(excerpt).toMatch(/^Website Development /);
    expect(excerpt).toContain("Starting price: USD 1200");
    expect(excerpt).toContain("/services/website-development");
  });

  it("returns no excerpt for unrelated questions", () => {
    expect(retrievePublicKnowledge("quasar nebula otter", "en")).toBe("");
  });

  it("retrieves a Bengali service entry without changing its price", () => {
    const excerpt = retrievePublicKnowledge("ওয়েবসাইট ডেভেলপমেন্ট এর দাম কত?", "bn");
    expect(excerpt).toContain("Starting price: USD 1200");
    expect(excerpt).toContain("/services/website-development");
  });
});
