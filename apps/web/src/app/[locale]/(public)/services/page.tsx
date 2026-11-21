import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublishedServices, getPublishedServiceGroups } from "@/lib/services-server";
import { WizardContainer } from "@/components/wizard/wizard-container";
import { getWizardQuestions } from "@/lib/wizard-server";
import { ServiceIcon } from "@/components/service-icon";
import { ArrowRight, Sparkles, X } from "lucide-react";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ group?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Services" });
  if (query?.group) {
    const groups = await getPublishedServiceGroups(locale);
    const grp = groups.find((g) => g.slug === query.group);
    if (grp) {
      return {
        title: `${grp.name} | ${t("metadata.title")}`,
        description: t("metadata.description"),
      };
    }
  }
  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
  };
}

export default async function ServicesPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, tDetail, tWizard, services, questions, groups] = await Promise.all([
    getTranslations({ locale, namespace: "Services" }),
    getTranslations({ locale, namespace: "ServiceDetail" }),
    getTranslations({ locale, namespace: "Wizard" }),
    getPublishedServices(),
    getWizardQuestions(),
    getPublishedServiceGroups(locale),
  ]);

  const activeGroup = query?.group ? groups.find((g) => g.slug === query.group) : null;
  const displayServices = activeGroup
    ? services.filter((s) => activeGroup.services.some((as) => as.slug === s.slug))
    : services;

  const wizardLabels = {
    stepLabel: tWizard.raw("stepLabel") as string,
    multiHint: tWizard("multiHint"),
    next: tWizard("next"),
    back: tWizard("back"),
    calculate: tWizard("calculate"),
    restart: tWizard("restart"),
    resultsTitle: tWizard("resultsTitle"),
    resultsSubtitle: tWizard("resultsSubtitle"),
    matchLabel: tWizard.raw("matchLabel") as string,
    startingFrom: tWizard("startingFrom"),
    customQuote: tWizard("customQuote"),
    viewService: tWizard("viewService"),
    requestService: tWizard("requestService"),
    ctaTitle: tWizard("ctaTitle"),
    ctaSubtitle: tWizard("ctaSubtitle"),
    contactUs: tWizard("contactUs"),
  };

  const modelLabels: Record<string, string> = {
    fixed: tDetail("fixedModel"),
    retainer: tDetail("retainerModel"),
    hourly: tDetail("hourlyModel"),
    custom: tDetail("customModel"),
  };

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

        {/* Quick jump to Service Finder CTA */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#service-finder"
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary shadow-subtle transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Sparkles className="h-4 w-4" />
            <span>{locale === "bn" ? "উপযুক্ত সেবা খুঁজে পেতে সার্ভিস ফাইন্ডার ব্যবহার করুন" : "Unsure what you need? Try our Service Finder"}</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Active Group Filter Banner */}
      {activeGroup ? (
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {locale === "bn" ? "ফিল্টার করা ক্যাটাগরি:" : "Category:"}
            </span>
            <span className="rounded-lg bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
              {activeGroup.name}
            </span>
            <span className="text-xs text-muted-foreground">
              ({displayServices.length} {locale === "bn" ? "টি সার্ভিস" : displayServices.length === 1 ? "service" : "services"})
            </span>
          </div>
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>{locale === "bn" ? "সব সার্ভিস দেখুন" : "View all services"}</span>
          </Link>
        </div>
      ) : null}

      {/* Services Grid or Empty State */}
      {displayServices.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-border/80 bg-card p-12 text-center shadow-subtle">
          <p className="text-base text-muted-foreground">
            {locale === "bn"
              ? "এই ক্যাটাগরিতে কোনো সার্ভিস পাওয়া যায়নি।"
              : "No services found in this category."}
          </p>
          <div className="mt-6">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
            >
              <span>{locale === "bn" ? "সব সার্ভিস দেখুন" : "Browse all services"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {displayServices.map((service) => {
          const name = locale === "bn" ? service.name_bn : service.name_en;
          const summary = locale === "bn" ? service.summary_bn : service.summary_en;
          const pricingLabel = modelLabels[service.pricing_model] || tDetail("customModel");
          const priceString = service.starting_from_usd
            ? tDetail("startingPriceLabel", { price: service.starting_from_usd.toLocaleString() })
            : tDetail("customQuote");

          return (
            <Card
              key={service.slug}
              id={service.slug}
              className="group flex flex-col border-border/70 bg-card transition-all hover:border-primary/50 hover:shadow-md"
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground overflow-hidden p-1.5 shrink-0">
                    <ServiceIcon icon={service.icon} className="h-5 w-5" imgClassName="h-5 w-5 object-contain" />
                  </div>
                  <Badge variant="secondary" className="font-medium text-xs">
                    {pricingLabel}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold">{name}</CardTitle>
                <CardDescription className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {summary}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-4 pt-2">
                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <span>{tDetail("startingFrom")}:</span>
                  <span className="font-semibold text-foreground">{priceString}</span>
                </div>
                <Link
                  href={`/services/${service.slug}`}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-foreground transition-all hover:border-primary hover:bg-accent hover:text-accent-foreground"
                >
                  <span>{locale === "bn" ? "বিস্তারিত ও বাজেট দেখুন" : "View Details & Pricing"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}

      {/* Interactive Service Finder Section */}
      <section
        id="service-finder"
        className="mt-24 scroll-mt-24 rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/90 to-brand-accent/5 p-6 shadow-subtle sm:p-10 lg:p-12"
      >
        <div className="mx-auto max-w-3xl text-center mb-10">
          <Badge variant="outline" className="mb-4 border-brand-accent/50 bg-brand-accent/10 text-primary">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {tWizard("hero.eyebrow")}
          </Badge>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
            {tWizard("hero.title")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            {tWizard("hero.description")}
          </p>
        </div>

        <WizardContainer
          questions={questions}
          locale={locale}
          labels={wizardLabels}
        />
      </section>

      {/* Call to action section */}
      <div className="mt-20 rounded-2xl border border-border/80 bg-gradient-to-b from-card to-muted/30 p-8 text-center shadow-subtle sm:p-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("cta.title")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t("cta.description")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/contact"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            {t("cta.button")}
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
          >
            {t("cta.viewHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
