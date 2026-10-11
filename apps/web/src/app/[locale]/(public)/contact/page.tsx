import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Contact" });
  return { title: t("metadata.title"), description: t("metadata.description") };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, supabase] = await Promise.all([
    getTranslations({ locale, namespace: "Contact" }),
    createClient(),
  ]);
  const { data } = await supabase.from("services")
    .select("id,name_en,name_bn")
    .eq("is_published", true)
    .is("archived_at", null)
    .order("sort_order");
  const services = (data ?? []).map((service) => ({
    id: service.id,
    name: locale === "bn" ? service.name_bn || service.name_en : service.name_en,
  }));

  return (
    <div className="contact-page">
      <section className="contact-intro">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
        <div className="contact-expectation"><strong>{t("expectationTitle")}</strong><span>{t("expectation")}</span></div>
      </section>
      <section className="contact-card" aria-labelledby="contact-form-title">
        <h2 id="contact-form-title">{t("formTitle")}</h2>
        <p>{t("formDescription")}</p>
        <ContactForm services={services} siteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""} />
      </section>
    </div>
  );
}

