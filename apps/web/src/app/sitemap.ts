import type { MetadataRoute } from "next";
import { SERVICES_CATALOG } from "@/lib/services-catalog";
import { getPortfolioItems } from "@/lib/portfolio-catalog";
import { getBlogPosts } from "@/lib/blog-catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://revcloud.dev";
  const now = new Date();

  const staticRoutes = [
    "",
    "/services",
    "/portfolio",
    "/pricing",
    "/blog",
    "/about",
    "/schedule",
    "/contact",
    "/wizard",
    "/terms",
    "/privacy",
  ];

  const entries: MetadataRoute.Sitemap = [];
  const publicUrl = (path: string) => `${baseUrl}${path || "/"}`;

  // Locale is stored in a cookie, so each page has one canonical public URL.
  for (const route of staticRoutes) {
    entries.push({
      url: publicUrl(route),
      lastModified: now,
      changeFrequency: route === "" ? "daily" : "weekly",
      priority:
        route === ""
          ? 1.0
          : route === "/services" || route === "/schedule"
          ? 0.9
          : 0.8,
    });
  }

  // Dynamic Service Detail Pages
  for (const service of SERVICES_CATALOG) {
    entries.push({
      url: publicUrl(`/services/${service.slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  // Dynamic Portfolio Project Pages
  try {
    const portfolioItems = await getPortfolioItems();
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
    const blogPosts = await getBlogPosts();
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
