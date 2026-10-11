import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/[locale]/(auth)/actions";
import { AdminNavigation } from "@/components/admin-navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { visibleAdminSections } from "@/lib/auth/admin-sections";
import { requireStaff } from "@/lib/auth/guards";

export default async function AdminLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [{ user, access }, t] = await Promise.all([
    requireStaff(locale),
    getTranslations({ locale, namespace: "Admin" }),
  ]);
  const displayName =
    (typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata.name === "string" && user.user_metadata.name) ||
    user.email ||
    t("unknownUser");
  const items = [
    { href: "/admin", label: t("dashboard") },
    ...visibleAdminSections(access.permissions).map((section) => ({
      href: `/admin/${section.slug}`,
      label: t(`sections.${section.slug}.title`),
    })),
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <span className="admin-brand-mark" aria-hidden="true">R</span>
          <span>
            <strong>{t("brand")}</strong>
            <small>{t("workspace")}</small>
          </span>
        </Link>

        <AdminNavigation items={items} label={t("navigation")} />

        <div className="admin-account">
          <span className="admin-avatar" aria-hidden="true">
            {displayName.slice(0, 1).toLocaleUpperCase(locale)}
          </span>
          <div>
            <strong>{displayName}</strong>
            <small>{access.roles.map((role) => role.name).join(" · ")}</small>
          </div>
          <form action={signOut.bind(null, locale)}>
            <button type="submit">{t("signOut")}</button>
          </form>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p>{t("signedInAs")}</p>
            <strong>{displayName}</strong>
          </div>
          <span className="admin-permission-count">
            {t("permissionCount", { count: access.permissions.length })}
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}
