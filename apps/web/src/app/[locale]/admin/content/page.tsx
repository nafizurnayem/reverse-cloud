import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";

const resources = ["services", "faqs", "portfolio", "blog", "settings"] as const;

export default async function ContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await requirePermission(locale, "content.manage");
  const t = await getTranslations({ locale, namespace: "AdminContent" });
  return (
    <main className="admin-page content-page">
      <header className="content-header">
        <div>
          <h1>{t("title")}</h1>
        </div>
      </header>
      <div className="content-resource-grid">
        {resources.map((resource, index) => (
          <Link href={`/admin/content/${resource}`} className="content-resource-card" key={resource}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{t(`resources.${resource}.title`)}</h2>
            <p>{t(`resources.${resource}.description`)}</p>
            <strong>{t("open")} →</strong>
          </Link>
        ))}
      </div>
    </main>
  );
}
