import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string | string[]; proposal?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Contact" });
  return { title: t("metadata.title"), description: t("metadata.description") };
}

export default async function ContactPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, supabase, query] = await Promise.all([
    getTranslations({ locale, namespace: "Contact" }),
    createClient(),
    searchParams,
  ]);
  const [servicesResult, authResult] = await Promise.all([
    supabase.from("services")
      .select("id,slug,name_en,name_bn")
      .eq("is_published", true)
      .is("archived_at", null)
      .order("sort_order"),
    supabase.auth.getUser().catch(() => null),
  ]);
  const services = (servicesResult.data ?? []).map((service) => ({
    id: service.id,
    slug: service.slug,
    name: locale === "bn" ? service.name_bn || service.name_en : service.name_en,
  }));
  const requestedSlug = typeof query.service === "string" ? query.service : "";
  const selectedServiceId = services.find((service) => service.slug === requestedSlug)?.id ?? "";
  const proposalMode = query.proposal === "1" || Boolean(requestedSlug);
  const authUser = authResult?.data.user;
  const metadata = authUser?.user_metadata;
  const initialName = typeof metadata?.full_name === "string" ? metadata.full_name
    : typeof metadata?.name === "string" ? metadata.name : "";
  const initialEmail = authUser?.email ?? "";

  return (
    <div className="contact-page">
      <section className="contact-intro">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t(proposalMode ? "proposalTitle" : "title")}</h1>
        <p>{t(proposalMode ? "proposalDescription" : "description")}</p>
        <div className="contact-expectation"><strong>{t("expectationTitle")}</strong><span>{t("expectation")}</span></div>
      </section>
      <section className="contact-card" aria-labelledby="contact-form-title">
        <h2 id="contact-form-title">{t(proposalMode ? "proposalFormTitle" : "formTitle")}</h2>
        <p>{t(proposalMode ? "proposalFormDescription" : "formDescription")}</p>
        <ContactForm
          key={`${selectedServiceId}:${proposalMode}`}
          services={services}
          selectedServiceId={selectedServiceId}
          initialName={initialName}
          initialEmail={initialEmail}
          proposalMode={proposalMode}
          siteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""}
        />
      </section>
    </div>
  );
}

