import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SERVICES_CATALOG } from "@/lib/services-catalog";
import {
  Briefcase,
  Calendar,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";


type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Pricing" });
  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
  };
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, tDetail] = await Promise.all([
    getTranslations({ locale, namespace: "Pricing" }),
    getTranslations({ locale, namespace: "ServiceDetail" }),
  ]);

  const models = [
    {
      icon: Briefcase,
      title: t("modelFixedTitle"),
      description: t("modelFixedDesc"),
      badge: tDetail("fixedModel"),
    },
    {
      icon: Calendar,
      title: t("modelRetainerTitle"),
      description: t("modelRetainerDesc"),
      badge: tDetail("retainerModel"),
    },
    {
      icon: Clock,
      title: t("modelHourlyTitle"),
      description: t("modelHourlyDesc"),
      badge: tDetail("hourlyModel"),
    },
    {
      icon: Layers,
      title: t("modelCustomTitle"),
      description: t("modelCustomDesc"),
      badge: tDetail("customModel"),
    },
  ];

  const faqs = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A") },
    { q: t("faq4Q"), a: t("faq4A") },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      {/* Hero section */}
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="outline" className="mb-4 border-brand-accent/50 bg-brand-accent/10 text-primary">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {t("hero.eyebrow")}
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          {t("hero.title")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {t("hero.description")}
        </p>
      </div>

      {/* Engagement Models */}
      <section className="mt-16" aria-labelledby="models-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="models-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("modelsTitle")}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t("modelsSubtitle")}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {models.map((model, idx) => {
            const Icon = model.icon;
            return (
              <Card
                key={idx}
                className="flex flex-col border-border/70 bg-card transition-all hover:border-primary/50"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="font-medium text-xs">
                      {model.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-bold">{model.title}</CardTitle>
                </CardHeader>
                <CardContent className="mt-auto text-sm leading-relaxed text-muted-foreground">
                  {model.description}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Starting Rates by Service */}
      <section className="mt-20" aria-labelledby="rates-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="rates-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("servicesTitle")}
            </h2>
            <p className="mt-1 text-base text-muted-foreground">
              {t("servicesSubtitle")}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            {t("currencyNote")}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES_CATALOG.map((service) => {
            const name = locale === "bn" ? service.name_bn : service.name_en;
            const price = service.starting_from_usd
              ? `$${service.starting_from_usd.toLocaleString()} USD`
              : tDetail("customQuote");

            return (
              <div
                key={service.slug}
                className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-subtle"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-[11px] uppercase">
                      {service.pricing_model}
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-foreground">{name}</h3>
                </div>

                <div className="mt-4 border-t border-border/60 pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">{t("startingFrom")}</span>
                    <span className="text-lg font-extrabold text-foreground">{price}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 pt-1">
                    <Link
                      href={`/services/${service.slug}`}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {t("viewDetail")} →
                    </Link>
                    <Link
                      href={`/contact?service=${service.slug}`}
                      className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      {t("requestEstimate")}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing FAQs Accordion */}
      <section className="mt-24" aria-labelledby="faqs-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="faqs-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("faqsTitle")}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t("faqsSubtitle")}
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-4">
          {faqs.map((faq, idx) => (
            <details
              key={idx}
              className="group rounded-xl border border-border/70 bg-card p-5 transition-all open:border-primary/40 open:shadow-subtle"
            >
              <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground transition-colors hover:text-primary">
                <span>{faq.q}</span>
                <span className="ml-4 shrink-0 transition-transform duration-200 group-open:rotate-180">
                  ▼
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Call to action section */}
      <div className="mt-20 rounded-2xl border border-border/80 bg-gradient-to-b from-card to-muted/30 p-8 text-center shadow-subtle sm:p-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("ctaTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t("ctaSubtitle")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/contact"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            {t("contactUs")}
          </Link>
          <Link
            href="/services"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
          >
            {locale === "bn" ? "সেবাসমূহ দেখুন" : "Browse Services"}
          </Link>
        </div>
      </div>
    </div>
  );
}
