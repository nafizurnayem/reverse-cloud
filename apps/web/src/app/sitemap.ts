import type { MetadataRoute } from "next";
import { SERVICES_CATALOG } from "@/lib/services-catalog";
import { getPortfolioItems } from "@/lib/portfolio-catalog";
import { getBlogPosts } from "@/lib/blog-catalog";
import { enabledContentTypes, enabledSections } from "@/lib/site-sections";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://revcloud.dev";
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];
  const publicUrl = (path: string) => `${baseUrl}${path}`;
  const contentTypes = new Set(enabledContentTypes());

  // Sections come from @/lib/site-sections; disabled sections leave the sitemap.
  // Locale is stored in a cookie, so each page has one canonical public URL.
  for (const section of enabledSections()) {
    entries.push({
      url: publicUrl(section.path),
      lastModified: now,
      changeFrequency: section.path === "/" ? "daily" : "weekly",
      priority: section.sitemapPriority,
    });
  }
  for (const legalPath of ["/terms", "/privacy"]) {
    entries.push({ url: publicUrl(legalPath), lastModified: now, changeFrequency: "weekly", priority: 0.8 });
  }

  // Dynamic Service Detail Pages
  for (const service of contentTypes.has("service") ? SERVICES_CATALOG : []) {
    entries.push({
      url: publicUrl(`/services/${service.slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  // Dynamic Portfolio Project Pages
  try {
    const portfolioItems = contentTypes.has("portfolio") ? await getPortfolioItems() : [];
    for (const item of portfolioItems) {
      entries.push({
        url: publicUrl(`/portfolio/${item.slug}`),
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.75,
      });
    }
  } catch {
    // If database unavailable, catalog fallback was already handled
  }

  // Dynamic Blog Post Pages
  try {
    const blogPosts = contentTypes.has("blog") ? await getBlogPosts() : [];
    for (const post of blogPosts) {
      entries.push({
        url: publicUrl(`/blog/${post.slug}`),
        lastModified: post.published_at ? new Date(post.published_at) : now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // If database unavailable, catalog fallback was already handled
  }

  return entries;
}
