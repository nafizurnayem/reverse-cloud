import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BLOG_CATALOG,
  getAllBlogSlugs,
  getBlogPostBySlug,
  getBlogPosts,
} from "../src/lib/blog-catalog";

describe("Blog Catalog", () => {
  it("verifies all blog posts conform to database publishing constraints and bilingual parity", () => {
    for (const post of BLOG_CATALOG) {
      if (post.status === "published") {
        expect(post.title_en.trim().length).toBeGreaterThan(0);
        expect(post.body_en.trim().length).toBeGreaterThan(0);
      }
      expect(post.title_bn.trim().length).toBeGreaterThan(0);
      expect(post.excerpt_en.trim().length).toBeGreaterThan(0);
      expect(post.excerpt_bn.trim().length).toBeGreaterThan(0);
      expect(post.body_bn.trim().length).toBeGreaterThan(0);
      expect(post.tags.length).toBeGreaterThan(0);
      expect(post.read_time_minutes).toBeGreaterThan(0);
    }
  });

  it("retrieves published blog posts", async () => {
    const posts = await getBlogPosts();
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((p) => p.status === "published")).toBe(true);
  });

  it("retrieves a blog post by slug", async () => {
    const post = await getBlogPostBySlug("building-production-agentic-workflows-pydantic-ai");
    expect(post).not.toBeNull();
    expect(post?.slug).toBe("building-production-agentic-workflows-pydantic-ai");
    expect(post?.author.name).toBe("Reverse Cloud Engineering");
  });

  it("returns null for non-existent blog post slug", async () => {
    const post = await getBlogPostBySlug("non-existent-blog-slug");
    expect(post).toBeNull();
  });

  it("returns all static slugs for SSG", () => {
    const slugs = getAllBlogSlugs();
    expect(slugs).toContain("building-production-agentic-workflows-pydantic-ai");
    expect(slugs).toContain("scaling-nextjs-with-postgres-rls");
    expect(slugs).toContain("optimizing-core-web-vitals-with-monetization");
  });
});
