import { describe, expect, it } from "vitest";
import {
  SITE_SECTIONS,
  chatLinkableSectionKeys,
  enabledContentTypes,
  footerSections,
  isChatLinkable,
  navSections,
  resolveSitePath,
  type SiteSection,
} from "../src/lib/site-sections";

function withBlogDisabled(): SiteSection[] {
  return SITE_SECTIONS.map((section) =>
    section.key === "blog" ? { ...section, enabled: false } : section,
  );
}

describe("site sections", () => {
  it("has unique keys and paths", () => {
    expect(new Set(SITE_SECTIONS.map((s) => s.key)).size).toBe(SITE_SECTIONS.length);
    expect(new Set(SITE_SECTIONS.map((s) => s.path)).size).toBe(SITE_SECTIONS.length);
  });

  it("builds the menus from enabled sections only", () => {
    const sections = withBlogDisabled();
    expect(navSections(sections).map((s) => s.key)).not.toContain("blog");
    expect(footerSections(sections).map((s) => s.key)).not.toContain("blog");
    expect(navSections().map((s) => s.key)).toContain("blog");
  });

  it("resolves section and detail paths", () => {
    expect(resolveSitePath("/")?.section.key).toBe("home");
    expect(resolveSitePath("/pricing")?.section.key).toBe("pricing");
    expect(resolveSitePath("/services/ai-automation")).toMatchObject({
      section: { key: "services" },
      slug: "ai-automation",
    });
    expect(resolveSitePath("/services/ai-automation/")?.slug).toBe("ai-automation");
    expect(resolveSitePath("/bn/portfolio/shop-app")).toMatchObject({
      section: { key: "portfolio" },
      slug: "shop-app",
    });
  });

  it("rejects unknown, nested, malformed and disabled paths", () => {
    expect(resolveSitePath("/admin")).toBeNull();
    expect(resolveSitePath("/portal/projects/1")).toBeNull();
    expect(resolveSitePath("/pricing/extra")).toBeNull();
    expect(resolveSitePath("/services/a/b")).toBeNull();
    expect(resolveSitePath("/services/<script>")).toBeNull();
    expect(resolveSitePath("services")).toBeNull();
    expect(resolveSitePath(`/services/${"a".repeat(300)}`)).toBeNull();
    expect(resolveSitePath("/blog/hello", withBlogDisabled())).toBeNull();
    expect(resolveSitePath("/blog", withBlogDisabled())).toBeNull();
  });

  it("only allows canonical, enabled chat links", () => {
    expect(isChatLinkable("/services/ai-automation")).toBe(true);
    expect(isChatLinkable("/")).toBe(true);
    expect(isChatLinkable("/en/services")).toBe(false);
    expect(isChatLinkable("https://evil.example/services")).toBe(false);
    expect(isChatLinkable("//evil.example")).toBe(false);
    expect(isChatLinkable("/blog/post", withBlogDisabled())).toBe(false);
  });

  it("derives chat-enabled sections and content types", () => {
    expect(enabledContentTypes()).toEqual(["service", "portfolio", "blog"]);
    expect(enabledContentTypes(withBlogDisabled())).toEqual(["service", "portfolio"]);
    expect(chatLinkableSectionKeys(withBlogDisabled())).not.toContain("blog");
  });
});
