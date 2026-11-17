"use client";

import { ArrowUpRight, BookOpen, Briefcase, FileText, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PageLinksCardData } from "@/lib/chat/protocol";
import { resolveChatLinks, type ResolvedChatLink } from "@/lib/chat/links";

const icons: Record<ResolvedChatLink["kind"], typeof Layers> = {
  section: FileText,
  service: Layers,
  portfolio: Briefcase,
  blog: BookOpen,
};

export function PageLinksCard({ data }: { data: PageLinksCardData }) {
  const tNav = useTranslations("Nav");
  const links = resolveChatLinks(data?.links);
  if (links.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {links.map((link) => {
        const Icon = icons[link.kind];
        const label = link.kind === "section" ? tNav(link.labelKey) : link.title;
        return (
          <Link
            key={link.path}
            href={link.path}
            className="group flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
        );
      })}
    </div>
  );
}
