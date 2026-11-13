import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { routing } from "@/i18n/routing";
import { visibleAdminSections } from "@/lib/auth/admin-sections";
import { staffDashboardPath } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/guards";

export default async function AdminPage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [{ access }, t] = await Promise.all([
    requireStaff(locale),
    getTranslations({ locale, namespace: "Admin" }),
  ]);
  const sections = visibleAdminSections(access.permissions);
  const dashboardPath = staffDashboardPath(access);

  return (
    <main className="admin-page">
      <div className="admin-header">
        <div>
          <h1>{t("dashboard")}</h1>
          <p>{t("accessDescription")}</p>
        </div>
      </div>

      {sections.length ? (
        <div className="admin-card-grid">
          {sections.map((section) => (
            <Link className="admin-card" href={`${dashboardPath}/${section.slug}`} key={section.slug}>
              <h3>{t(`sections.${section.slug}.title`)}</h3>
              <p>{t(`sections.${section.slug}.description`)}</p>
              <span className="admin-card-link">{t("open")} →</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="admin-empty">{t("noTools")}</p>
      )}
    </main>
  );
}
