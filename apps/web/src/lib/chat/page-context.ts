import "server-only";
import { getBlogPostBySlug } from "@/lib/blog-catalog";
import { getPortfolioItemBySlug } from "@/lib/portfolio-catalog";
import { getServiceBySlug } from "@/lib/services-server";
import {
  chatLinkableSectionKeys,
  enabledContentTypes,
  resolveSitePath,
  type SiteContentType,
  type SiteSectionKey,
} from "@/lib/site-sections";

type Locale = "en" | "bn";

/** Verified description of the page the visitor is viewing, sent to the AI service. */
export interface ChatPageContext {
  section: SiteSectionKey;
  path: string;
  slug?: string;
  content_type?: SiteContentType;
  title?: string;
}

/** Site structure the AI service may use for links and knowledge filtering. */
export interface ChatSiteContext {
  enabled_sections: SiteSectionKey[];
  enabled_content_types: SiteContentType[];
}

export function chatSiteContext(): ChatSiteContext {
  return {
    enabled_sections: chatLinkableSectionKeys(),
    enabled_content_types: enabledContentTypes(),
  };
}

async function publishedTitle(
  contentType: SiteContentType,
  slug: string,
  locale: Locale,
): Promise<string | null> {
  const isBn = locale === "bn";
  if (contentType === "service") {
    const item = await getServiceBySlug(slug);
    return item ? (isBn ? item.name_bn || item.name_en : item.name_en) : null;
  }
  if (contentType === "portfolio") {
    const item = await getPortfolioItemBySlug(slug);
    return item ? (isBn ? item.title_bn || item.title_en : item.title_en) : null;
  }
  const item = await getBlogPostBySlug(slug);
  return item ? (isBn ? item.title_bn || item.title_en : item.title_en) : null;
}

/**
 * Turn an untrusted browser path into page context. Only enabled sections and
 * published detail items pass; everything else yields null. Titles always come
 * from the server, never from the browser.
 */
export async function resolveChatPageContext(
  path: string | undefined,
  locale: Locale,
): Promise<ChatPageContext | null> {
  if (!path) return null;
  const resolved = resolveSitePath(path);
  if (!resolved) return null;

  const { section, slug } = resolved;
  const contentType = section.chat.contentType;
  if (!slug || !contentType) return { section: section.key, path: section.path };

  try {
    const title = await publishedTitle(contentType, slug, locale);
    if (!title) return { section: section.key, path: section.path };
    return {
      section: section.key,
      path: `${section.path}/${slug}`,
      slug,
      content_type: contentType,
      title: title.slice(0, 200),
    };
  } catch {
    // Page awareness is a hint; fall back to the section if lookup fails.
    return { section: section.key, path: section.path };
  }
}
