import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
};

export default async function PortalPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "Portal" });

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="portal-heading">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 id="portal-heading">{t("title")}</h1>
        {query.invite === "accepted" ? (
          <p className="auth-message auth-success" role="status">{t("inviteAccepted")}</p>
        ) : null}
        <p className="description">{t("description")}</p>
        <div className="auth-actions">
          <Link className="auth-button auth-button-secondary" href={`/${locale}`}>
            {t("returnHome")}
          </Link>
        </div>
      </section>
    </main>
  );
}
