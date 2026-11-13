"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Star,
  Calculator,
  Inbox,
  Users,
  Briefcase,
  CreditCard,
  Calendar,
  ShieldCheck,
  Activity,
  Layers,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  slug?: string;
};

const SECTION_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  content: FileText,
  reviews: Star,
  estimator: Calculator,
  leads: Inbox,
  clients: Users,
  projects: Briefcase,
  payments: CreditCard,
  meetings: Calendar,
  staff: ShieldCheck,
  audit: Activity,
};

export function AdminNavigation({
  items,
  label,
}: {
  items: AdminNavItem[];
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="admin-navigation" aria-label={label}>
      {items.map((item) => {
        const active = !item.href.slice(1).includes("/")
          ? pathname === item.href
          : pathname.startsWith(`${item.href}/`) || pathname === item.href;

        const Icon = (item.slug && SECTION_ICONS[item.slug]) || SECTION_ICONS.dashboard || Layers;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-nav-link ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="admin-nav-icon-wrap" aria-hidden="true">
              <Icon size={17} strokeWidth={1.85} />
            </span>
            <span className="admin-nav-label">{item.label}</span>
            {active && <span className="admin-nav-active-pill" aria-hidden="true" />}
          </Link>
        );
      })}
    </nav>
  );
}
