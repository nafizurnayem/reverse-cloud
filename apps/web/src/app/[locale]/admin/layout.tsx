import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LogOut, Sparkles, ShieldCheck } from "lucide-react";
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

      {/* ── Top Navigation Bar (PostHog full-width style) ── */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <Link className="admin-brand" href={dashboardPath} aria-label={t("brand")}>
            <span className="admin-brand-mark" aria-hidden="true">
              <span className="admin-brand-mark-inner">R</span>
            </span>
            <div className="admin-brand-title-wrap">
              <span className="admin-brand-name">{t("brand")}</span>
              <span className="admin-brand-pill">{t("workspace")}</span>
            </div>
          </Link>
        </div>

        <nav className="admin-topbar-nav" aria-label="Quick links">
          <Link href={dashboardPath} className="admin-topbar-link">
            {t("dashboard")}
          </Link>
          {visibleAdminSections(access.permissions).slice(0, 5).map((section) => (
            <Link
              key={section.slug}
              href={`${dashboardPath}/${section.slug}`}
              className="admin-topbar-link"
            >
              {t(`sections.${section.slug}.title`)}
            </Link>
          ))}
        </nav>

        <div className="admin-topbar-right">
          <Link
            href={`${dashboardPath}/leads`}
            className="admin-topbar-cta"
            title="Live Operations"
          >
            <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Live Workspace</span>
          </Link>

          <div className="admin-topbar-user">
            <span className="admin-avatar" aria-hidden="true">
              {typeof displayName === "string"
                ? displayName.slice(0, 1).toLocaleUpperCase(locale)
                : "S"}
            </span>
            <div className="admin-user-info">
              <strong title={typeof displayName === "string" ? displayName : t("unknownUser")}>
                {typeof displayName === "string" ? displayName : t("unknownUser")}
              </strong>
              <small title={access.roles.map((role) => role.name).join(" · ")}>
                <ShieldCheck size={11} strokeWidth={2} aria-hidden="true" />
                {access.roles.map((role) => role.name).join(" · ")}
              </small>
            </div>
          </div>

          <div className="admin-topbar-controls">
            <AdminThemeToggle
              variant="compact"
              labelLight={t("themeLight")}
              labelDark={t("themeDark")}
              toggleLabel={t("themeToggle")}
            />
            <form action={signOut.bind(null, locale)} className="admin-signout-form">
              <button type="submit" className="admin-signout-button" title={t("signOut")}>
                <LogOut size={15} strokeWidth={1.85} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Main Layout: Floating Icon Rail + Main Stage ── */}
      <div className="admin-body-layout">
        {/* Left Floating Rail */}
        <aside className="admin-sidebar" aria-label={t("navigation")}>
          <div className="admin-sidebar-nav">
            <AdminNavigation items={items} label={t("navigation")} />
          </div>
        </aside>

        {/* Center Main Stage */}
        <main className="admin-workspace">
          {children}
        </main>
      </div>
    </div>
  );
}
