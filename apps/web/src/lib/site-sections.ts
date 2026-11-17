/**
 * Single source of truth for the public website's sections.
 *
 * The header, footer, sitemap and chatbot all read this list. To remove or
 * hide a section, change it here (set `enabled: false` or delete the entry),
 * then delete its page folder. The chatbot learns about enabled sections from
 * the signed request that `/api/chat` sends, so the AI service needs no change.
 *
 * Keep this file free of server-only imports: client components use it.
 */

export type SiteSectionKey =
  | "home"
  | "services"
  | "portfolio"
  | "pricing"
  | "blog"
  | "about"
  | "wizard"
  | "schedule"
  | "contact";

/** Sections whose `/path/[slug]` detail pages are backed by published database content. */
export type SiteContentType = "service" | "portfolio" | "blog";

export interface SiteSection {
  key: SiteSectionKey;
  /** Clean, locale-neutral path, e.g. "/services". */
  path: string;
  /** Translation key inside the `Nav` and `Footer` namespaces. */
  labelKey: SiteSectionKey;
  /** False removes the section from the menus, sitemap and chatbot. */
  enabled: boolean;
  showInNav: boolean;
  showInFooter: boolean;
  sitemapPriority: number;
  chat: {
    /** The chatbot may send visitors to this section. */
    linkable: boolean;
    /** Set when `/path/[slug]` pages exist for published content of this type. */
    contentType?: SiteContentType;
    /** Keys inside `Chat.suggestions` shown as quick replies on this section. */
    suggestionKeys: string[];
    /** Quick replies on a `/path/[slug]` detail page; defaults to `suggestionKeys`. */
    detailSuggestionKeys?: string[];
  };
}

export const SITE_SECTIONS: readonly SiteSection[] = [
  {
    key: "home",
    path: "/",
    labelKey: "home",
    enabled: true,
    showInNav: true,
    showInFooter: true,
    sitemapPriority: 1,
    chat: { linkable: true, suggestionKeys: ["whatServices", "getEstimate", "bookCall"] },
  },
  {
    key: "services",
    path: "/services",
    labelKey: "services",
    enabled: true,
    showInNav: true,
    showInFooter: true,
    sitemapPriority: 0.9,
    chat: {
      linkable: true,
      contentType: "service",
      suggestionKeys: ["whichServiceFits", "getEstimate", "bookCall"],
      detailSuggestionKeys: ["thisService", "similarProjects", "bookCall"],
    },
  },
  {
    key: "portfolio",
    path: "/portfolio",
    labelKey: "portfolio",
    enabled: true,
    showInNav: true,
    showInFooter: true,
    sitemapPriority: 0.8,
    chat: {
      linkable: true,
      contentType: "portfolio",
      suggestionKeys: ["similarProjects", "getEstimate", "bookCall"],
      detailSuggestionKeys: ["buildSimilar", "getEstimate", "bookCall"],
    },
  },
  {
    key: "pricing",
    path: "/pricing",
    labelKey: "pricing",
    enabled: true,
    showInNav: true,
    showInFooter: true,
    sitemapPriority: 0.8,
    chat: { linkable: true, suggestionKeys: ["getEstimate", "whatAffectsPrice", "bookCall"] },
  },
  {
    key: "blog",
    path: "/blog",
    labelKey: "blog",
    enabled: true,
    showInNav: true,
    showInFooter: true,
    sitemapPriority: 0.8,
    chat: {
      linkable: true,
      contentType: "blog",
      suggestionKeys: ["applyToMyProject", "whatServices", "bookCall"],
    },
  },
  {
    key: "about",
    path: "/about",
    labelKey: "about",
    enabled: true,
    showInNav: true,
    showInFooter: true,
    sitemapPriority: 0.8,
    chat: { linkable: true, suggestionKeys: ["howYouWork", "whatServices", "bookCall"] },
  },
  {
    key: "wizard",
    path: "/wizard",
    labelKey: "wizard",
    enabled: true,
    showInNav: true,
    showInFooter: true,
    sitemapPriority: 0.8,
    chat: { linkable: true, suggestionKeys: ["whichServiceFits", "getEstimate"] },
  },
  {
    key: "schedule",
    path: "/schedule",
    labelKey: "schedule",
    enabled: true,
    showInNav: true,
    showInFooter: false,
    sitemapPriority: 0.9,
    chat: { linkable: true, suggestionKeys: ["bookCall", "whatHappensOnCall"] },
  },
  {
    key: "contact",
    path: "/contact",
    labelKey: "contact",
    enabled: true,
    showInNav: true,
    showInFooter: true,
    sitemapPriority: 0.8,
    chat: { linkable: true, suggestionKeys: ["talkToHuman", "bookCall"] },
  },
];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function enabledSections(sections: readonly SiteSection[] = SITE_SECTIONS): SiteSection[] {
  return sections.filter((section) => section.enabled);
}

export function navSections(sections: readonly SiteSection[] = SITE_SECTIONS): SiteSection[] {
  return enabledSections(sections).filter((section) => section.showInNav);
}

export function footerSections(sections: readonly SiteSection[] = SITE_SECTIONS): SiteSection[] {
  return enabledSections(sections).filter((section) => section.showInFooter);
}

export function sectionByKey(
  key: string,
  sections: readonly SiteSection[] = SITE_SECTIONS,
): SiteSection | null {
  return enabledSections(sections).find((section) => section.key === key) ?? null;
}

/** Content types the chatbot may link to and quote, derived from enabled sections. */
export function enabledContentTypes(sections: readonly SiteSection[] = SITE_SECTIONS): SiteContentType[] {
  return enabledSections(sections)
    .filter((section) => section.chat.linkable)
    .flatMap((section) => (section.chat.contentType ? [section.chat.contentType] : []));
}

/** Keys of sections the chatbot may link to. */
export function chatLinkableSectionKeys(sections: readonly SiteSection[] = SITE_SECTIONS): SiteSectionKey[] {
  return enabledSections(sections)
    .filter((section) => section.chat.linkable)
    .map((section) => section.key);
}

function normalizePath(pathname: string): string | null {
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.length > 200) return null;
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? "";
  const trimmed = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
  // Legacy locale-prefixed links (/en/..., /bn/...) map to their clean equivalent.
  const unprefixed = trimmed.replace(/^\/(?:en|bn)(?=\/|$)/, "") || "/";
  return unprefixed.toLowerCase();
}

/**
 * Map a browser path to an enabled section and, for content sections, a slug.
 * Returns null for unknown, disabled or malformed paths.
 */
export function resolveSitePath(
  pathname: string,
  sections: readonly SiteSection[] = SITE_SECTIONS,
): { section: SiteSection; slug?: string } | null {
  const path = normalizePath(pathname);
  if (!path) return null;

  for (const section of enabledSections(sections)) {
    if (path === section.path) return { section };
    if (section.path === "/" || !section.chat.contentType) continue;
    const prefix = `${section.path}/`;
    if (!path.startsWith(prefix)) continue;
    const slug = path.slice(prefix.length);
    if (slugPattern.test(slug) && slug.length <= 120) return { section, slug };
  }
  return null;
}

/** True when the chatbot may link to this path. */
export function isChatLinkable(path: string, sections: readonly SiteSection[] = SITE_SECTIONS): boolean {
  if (typeof path !== "string" || path !== normalizePath(path)) return false;
  const resolved = resolveSitePath(path, sections);
  return Boolean(resolved?.section.chat.linkable);
}

const defaultSuggestionKeys = ["whatServices", "getEstimate", "bookCall"];

/** Quick-reply keys (inside `Chat.suggestions`) for the page at `pathname`. */
export function chatSuggestionKeys(
  pathname: string,
  sections: readonly SiteSection[] = SITE_SECTIONS,
): string[] {
  const resolved = resolveSitePath(pathname, sections);
  if (!resolved) return defaultSuggestionKeys;
  const { section, slug } = resolved;
  return (slug && section.chat.detailSuggestionKeys) || section.chat.suggestionKeys;
}

const chatPagePathPattern = /^\/[a-z0-9\-/]{0,199}$/;

/** The path to send with a chat request, or undefined when it can't be sent. */
export function chatPagePath(pathname: string | null | undefined): string | undefined {
  if (!pathname || !chatPagePathPattern.test(pathname) || pathname.includes("//")) return undefined;
  return pathname;
}

/** The enabled section whose `/path/[slug]` pages show this content type. */
export function sectionForContentType(
  contentType: SiteContentType,
  sections: readonly SiteSection[] = SITE_SECTIONS,
): SiteSection | null {
  return enabledSections(sections).find((section) => section.chat.contentType === contentType) ?? null;
}
