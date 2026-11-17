import { describe, expect, it } from "vitest";
import { resolveChatLinks } from "../src/lib/chat/links";
import { SITE_SECTIONS, type SiteSection } from "../src/lib/site-sections";

const withoutBlog: SiteSection[] = SITE_SECTIONS.map((section) =>
  section.key === "blog" ? { ...section, enabled: false } : section,
);

describe("resolveChatLinks", () => {
  it("maps section keys and content slugs to site paths", () => {
    expect(resolveChatLinks([
      { kind: "section", section: "pricing" },
      { kind: "service", slug: "ai-automation", title: "AI Automation" },
      { kind: "portfolio", slug: "shop-app", title: "Shop App" },
      { kind: "blog", slug: "rag-guide", title: "RAG Guide" },
    ])).toEqual([
      { kind: "section", path: "/pricing", labelKey: "pricing" },
      { kind: "service", path: "/services/ai-automation", title: "AI Automation" },
      { kind: "portfolio", path: "/portfolio/shop-app", title: "Shop App" },
      { kind: "blog", path: "/blog/rag-guide", title: "RAG Guide" },
    ]);
  });

  it("drops links to disabled sections", () => {
    expect(resolveChatLinks([
      { kind: "section", section: "blog" },
      { kind: "blog", slug: "rag-guide", title: "RAG Guide" },
      { kind: "section", section: "contact" },
    ], withoutBlog)).toEqual([{ kind: "section", path: "/contact", labelKey: "contact" }]);
  });

  it("ignores URLs, unknown sections and malformed slugs", () => {
    expect(resolveChatLinks([
      { kind: "section", section: "admin" },
      { kind: "section", section: "https://evil.example" },
      { kind: "service", slug: "../admin", title: "x" },
      { kind: "service", slug: "Ok-Slug", title: "x" },
      { kind: "service", slug: "fine", title: "   " },
      { kind: "external", path: "https://evil.example" },
      { kind: "service", path: "/admin", title: "x" },
      null,
      "string",
    ])).toEqual([]);
    expect(resolveChatLinks("not-an-array")).toEqual([]);
  });

  it("deduplicates and caps the list", () => {
    const links = resolveChatLinks([
      { kind: "section", section: "pricing" },
      { kind: "section", section: "pricing" },
      { kind: "section", section: "contact" },
      { kind: "section", section: "schedule" },
      { kind: "section", section: "about" },
      { kind: "section", section: "services" },
    ]);
    expect(links.map((link) => link.path)).toEqual(["/pricing", "/contact", "/schedule", "/about"]);
  });
});
