import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
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

  // Static Pages with alternate language links
  for (const route of staticRoutes) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: now,
        changeFrequency: route === "" ? "daily" : "weekly",
        priority:
          route === ""
            ? 1.0
            : route === "/services" || route === "/schedule"
            ? 0.9
            : 0.8,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((loc) => [loc, `${baseUrl}/${loc}${route}`]),
          ),
        },
      });
    }
  }

  // Dynamic Service Detail Pages
  for (const service of SERVICES_CATALOG) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${baseUrl}/${locale}/services/${service.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.85,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((loc) => [
              loc,
              `${baseUrl}/${loc}/services/${service.slug}`,
            ]),
          ),
        },
      });
    }
  }

  // Dynamic Portfolio Project Pages
  try {
    const portfolioItems = await getPortfolioItems();
    for (const item of portfolioItems) {
      for (const locale of routing.locales) {
        entries.push({
          url: `${baseUrl}/${locale}/portfolio/${item.slug}`,
          lastModified: now,
          changeFrequency: "monthly",
          priority: 0.75,
          alternates: {
            languages: Object.fromEntries(
              routing.locales.map((loc) => [
                loc,
                `${baseUrl}/${loc}/portfolio/${item.slug}`,
              ]),
            ),
          },
        });
      }
    }
  } catch {
    // If database unavailable, catalog fallback was already handled
  }

  // Dynamic Blog Post Pages
  try {
    const blogPosts = await getBlogPosts();
    for (const post of blogPosts) {
      for (const locale of routing.locales) {
        entries.push({
          url: `${baseUrl}/${locale}/blog/${post.slug}`,
          lastModified: post.published_at ? new Date(post.published_at) : now,
          changeFrequency: "monthly",
          priority: 0.7,
          alternates: {
            languages: Object.fromEntries(
              routing.locales.map((loc) => [
                loc,
                `${baseUrl}/${loc}/blog/${post.slug}`,
              ]),
            ),
          },
        });
      }
    }
  } catch {
    // If database unavailable, catalog fallback was already handled
  }

  return entries;
}
