import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://revcloud.dev";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/portal/",
          "/admin/",
          "/auth/",
          "/accept-invite",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
