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
      <section className="admin-hero">
        <p className="admin-kicker">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </section>

      <section aria-labelledby="admin-tools-heading">
        <div className="admin-section-heading">
          <div>
            <p className="admin-kicker">{t("accessEyebrow")}</p>
            <h2 id="admin-tools-heading">{t("accessTitle")}</h2>
          </div>
          <p>{t("accessDescription")}</p>
        </div>

        {sections.length ? (
          <div className="admin-card-grid">
            {sections.map((section, index) => (
              <Link className="admin-card" href={`${dashboardPath}/${section.slug}`} key={section.slug}>
                <span className="admin-card-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{t(`sections.${section.slug}.title`)}</h3>
                <p>{t(`sections.${section.slug}.description`)}</p>
                <span className="admin-card-link">{t("open")} →</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="admin-empty">{t("noTools")}</p>
        )}
      </section>
    </main>
  );
}
