import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { retrievePublicKnowledge } from "../src/lib/chat/public-knowledge";

describe("temporary public-site retrieval", () => {
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
