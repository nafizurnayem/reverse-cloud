import type { PageLinkData } from "@/lib/chat/protocol";
import {
  SITE_SECTIONS,
  isChatLinkable,
  sectionByKey,
  sectionForContentType,
  type SiteSection,
  type SiteSectionKey,
} from "@/lib/site-sections";

export type ResolvedChatLink =
  | { kind: "section"; path: string; labelKey: SiteSectionKey }
  | { kind: "service" | "portfolio" | "blog"; path: string; title: string };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxLinks = 4;

/**
 * Turn AI link suggestions into site paths using the shared section list.
 * Anything that doesn't map to an enabled, linkable page is dropped, so the
 * chat can never render a link the site doesn't offer.
 */
export function resolveChatLinks(
  links: unknown,
  sections: readonly SiteSection[] = SITE_SECTIONS,
): ResolvedChatLink[] {
  if (!Array.isArray(links)) return [];
  const resolved: ResolvedChatLink[] = [];
  const seen = new Set<string>();

  for (const raw of links as Partial<PageLinkData & { section: unknown; slug: unknown; title: unknown }>[]) {
    if (!raw || typeof raw !== "object") continue;
    let link: ResolvedChatLink | null = null;

    if (raw.kind === "section" && typeof raw.section === "string") {
      const section = sectionByKey(raw.section, sections);
      if (section) link = { kind: "section", path: section.path, labelKey: section.labelKey };
    } else if (
      (raw.kind === "service" || raw.kind === "portfolio" || raw.kind === "blog")
      && typeof raw.slug === "string" && slugPattern.test(raw.slug)
      && typeof raw.title === "string" && raw.title.trim()
    ) {
      const section = sectionForContentType(raw.kind, sections);
      if (section) {
        link = { kind: raw.kind, path: `${section.path}/${raw.slug}`, title: raw.title.trim().slice(0, 120) };
      }
    }

    if (!link || seen.has(link.path) || !isChatLinkable(link.path, sections)) continue;
    seen.add(link.path);
    resolved.push(link);
    if (resolved.length === maxLinks) break;
  }
  return resolved;
}
