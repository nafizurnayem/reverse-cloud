import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/[locale]/(auth)/actions";
import { AdminNavigation } from "@/components/admin-navigation";
import { AdminThemeToggle } from "@/components/admin-theme-toggle";
import { routing } from "@/i18n/routing";
import { visibleAdminSections } from "@/lib/auth/admin-sections";
import { staffDashboardPath } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/guards";
import Link from "next/link";

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
  const dashboardPath = staffDashboardPath(access);
  const items = [
    { href: dashboardPath, label: t("dashboard"), slug: "dashboard" },
    ...visibleAdminSections(access.permissions).map((section) => ({
      href: `${dashboardPath}/${section.slug}`,
      label: t(`sections.${section.slug}.title`),
      slug: section.slug,
    })),
  ];

  return (
    <div className="admin-shell" id="admin-shell">
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('rc_admin_theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d)){document.getElementById('admin-shell').setAttribute('data-theme','dark');}}catch(e){}})();`,
        }}
      />
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Link className="admin-brand" href={dashboardPath}>
            <span className="admin-brand-mark" aria-hidden="true">
              <span className="admin-brand-mark-inner">R</span>
            </span>
            <div className="admin-brand-info">
              <strong>{t("brand")}</strong>
              <small className="admin-brand-badge">{t("workspace")}</small>
            </div>
          </Link>
        </div>

        <div className="admin-sidebar-body">
          <div className="admin-sidebar-section-label">{t("navigation")}</div>
          <AdminNavigation items={items} label={t("navigation")} />
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-account-widget">
            <span className="admin-avatar" aria-hidden="true">
              {displayName.slice(0, 1).toLocaleUpperCase(locale)}
            </span>
            <div className="admin-account-details">
              <strong title={displayName}>{displayName}</strong>
              <small>{access.roles.map((role) => role.name).join(" · ")}</small>
            </div>
          </div>

          <div className="admin-sidebar-controls">
            <AdminThemeToggle
              variant="default"
              labelLight={t("themeLight")}
              labelDark={t("themeDark")}
              toggleLabel={t("themeToggle")}
            />
            <form action={signOut.bind(null, locale)} className="admin-signout-form">
              <button type="submit" className="admin-signout-button" title={t("signOut")}>
                <LogOut size={15} strokeWidth={1.85} aria-hidden="true" />
                <span>{t("signOut")}</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-topbar-identity">
            <strong>{displayName}</strong>
            <small>{access.roles.map((role) => role.name).join(" · ")}</small>
          </div>
          <div className="admin-topbar-actions">
            <AdminThemeToggle
              variant="compact"
              labelLight={t("themeLight")}
              labelDark={t("themeDark")}
              toggleLabel={t("themeToggle")}
            />
            <span className="admin-permission-count">
              {t("permissionCount", { count: access.permissions.length })}
            </span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
