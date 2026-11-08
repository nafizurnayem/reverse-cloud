"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
};

export function AdminNavigation({ items, label }: { items: Item[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav className="admin-navigation" aria-label={label}>
      {items.map((item) => {
        const active = !item.href.slice(1).includes("/")
          ? pathname === item.href
          : pathname.startsWith(`${item.href}/`) || pathname === item.href;

        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
            <span className="admin-nav-marker" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
