import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { findAdminSection } from "@/lib/auth/admin-sections";
import { requirePermission } from "@/lib/auth/guards";

export default async function AdminSectionPage({ params }: {
  params: Promise<{ locale: string; section: string }>;
}) {
  const { locale, section: value } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const section = findAdminSection(value);
  if (!section) notFound();

  await requirePermission(locale, section.permissions);
  const t = await getTranslations({ locale, namespace: "Admin" });

  return (
    <main className="admin-page">
      <div className="admin-header">
        <div>
          <h1>{t(`sections.${section.slug}.title`)}</h1>
          <p>{t(`sections.${section.slug}.description`)}</p>
        </div>
      </div>
      <section className="admin-placeholder" aria-label={t("statusLabel")}>
        <span className="admin-status-dot" aria-hidden="true" />
        <div>
          <strong>{t("connectedTitle")}</strong>
          <p>{t("connectedDescription")}</p>
        </div>
      </section>
    </main>
  );
}
