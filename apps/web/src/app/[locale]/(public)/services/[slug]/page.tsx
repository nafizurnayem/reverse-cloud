import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAllServiceSlugs,
  SERVICES_CATALOG,
} from "@/lib/services-catalog";
import { getServiceBySlug } from "@/lib/services-server";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  DollarSign,
  Globe,
  Layers,
  Network,
  Palette,
  Rocket,
  Server,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Globe,
  Cpu,
  Bot,
  Palette,
  Layers,
  Server,
  Network,
  TrendingUp,
  Users,
  DollarSign,
  Rocket,
};

export async function generateStaticParams() {
  const slugs = getAllServiceSlugs();
  const params: { locale: string; slug: string }[] = [];

  for (const locale of routing.locales) {
    for (const slug of slugs) {
      params.push({ locale, slug });
    }
  }

  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const service = await getServiceBySlug(slug);
  if (!service) return { title: "Service Not Found" };

  const name = locale === "bn" ? service.name_bn : service.name_en;
  const summary = locale === "bn" ? service.summary_bn : service.summary_en;

  return {
    title: `${name} — Reverse Cloud`,
    description: summary,
    openGraph: {
      title: `${name} — Reverse Cloud`,
      description: summary,
      type: "website",
    },
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, service] = await Promise.all([
    getTranslations({ locale, namespace: "ServiceDetail" }),
    getServiceBySlug(slug),
  ]);

  if (!service) {
    notFound();
  }

  const name = locale === "bn" ? service.name_bn : service.name_en;
  const summary = locale === "bn" ? service.summary_bn : service.summary_en;
  const body = locale === "bn" ? service.body_bn : service.body_en;
  const deliverables = locale === "bn" ? service.deliverables_bn : service.deliverables_en;
  const processSteps = locale === "bn" ? service.process_bn : service.process_en;
  const faqs = locale === "bn" ? service.faqs_bn : service.faqs_en;

  // Icon component
  const IconComponent = iconMap[service.icon] || Globe;

  // Format pricing model label
  const modelLabels: Record<string, string> = {
    fixed: t("fixedModel"),
    retainer: t("retainerModel"),
    hourly: t("hourlyModel"),
    custom: t("customModel"),
  };
  const pricingLabel = modelLabels[service.pricing_model] || t("customModel");

  // Format price string
  const startingPriceString = service.starting_from_usd
    ? t("startingPriceLabel", { price: service.starting_from_usd.toLocaleString() })
    : t("customQuote");

  // Related other services
  const otherServices = SERVICES_CATALOG.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      {/* Back button & Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <Link
          href="/services"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("backToServices")}</span>
        </Link>
      </nav>

      {/* Hero Header */}
      <header className="rounded-2xl border border-border/70 bg-gradient-to-b from-card to-background p-6 shadow-sm sm:p-10 lg:p-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4 md:max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant="outline" className="border-brand-accent/50 bg-brand-accent/10 text-primary font-medium">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {pricingLabel}
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                {service.slug}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <IconComponent className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                {name}
              </h1>
            </div>

            <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {summary}
            </p>
          </div>

          {/* Pricing Highlight Card */}
          <div className="shrink-0 rounded-xl border border-border/80 bg-card/80 p-5 shadow-subtle backdrop-blur-sm md:w-72">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("startingFrom")}
            </span>
            <div className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {startingPriceString}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {pricingLabel}
            </p>
            <div className="mt-5 space-y-2">
              <Link
                href={`/contact?service=${service.slug}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                <span>{t("requestProposal")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Detailed Body Overview */}
        {body && (
          <div className="mt-8 border-t border-border/60 pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("overview")}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-foreground/90 sm:text-lg">
              {body}
            </p>
          </div>
        )}
      </header>

      {/* Deliverables Section */}
      {deliverables && deliverables.length > 0 && (
        <section className="mt-16 sm:mt-20" aria-labelledby="deliverables-heading">
          <div className="max-w-2xl">
            <h2 id="deliverables-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("deliverablesTitle")}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              {t("deliverablesSubtitle")}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deliverables.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3.5 rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-subtle"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm font-medium leading-relaxed text-foreground/90">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Execution Methodology / Process */}
      {processSteps && processSteps.length > 0 && (
        <section className="mt-16 sm:mt-20" aria-labelledby="process-heading">
          <div className="max-w-2xl">
            <h2 id="process-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("processTitle")}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              {t("processSubtitle")}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step) => (
              <Card
                key={step.step}
                className="relative flex flex-col border-border/70 bg-card/60 transition-all hover:border-primary/50"
              >
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
                      0{step.step}
                    </span>
                  </div>
                  <CardTitle className="text-lg font-bold">{step.title}</CardTitle>
                </CardHeader>
                <CardContent className="mt-auto text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Tech Stack */}
      {service.tech_stack && service.tech_stack.length > 0 && (
        <section className="mt-16 sm:mt-20" aria-labelledby="tech-stack-heading">
          <h2 id="tech-stack-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
            {t("techStackTitle")}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {service.tech_stack.map((tech) => (
              <Badge
                key={tech}
                variant="secondary"
                className="px-3 py-1.5 font-mono text-xs font-medium tracking-wide"
              >
                {tech}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* FAQs Accordion / Section */}
      {faqs && faqs.length > 0 && (
        <section className="mt-16 sm:mt-20" aria-labelledby="faqs-heading">
          <div className="max-w-2xl">
            <h2 id="faqs-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("faqsTitle")}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              {t("faqsSubtitle")}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {faqs.map((faq, idx) => (
              <details
                key={idx}
                className="group rounded-xl border border-border/70 bg-card p-5 transition-all open:border-primary/40 open:shadow-subtle"
              >
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground transition-colors hover:text-primary">
                  <span>{faq.question}</span>
                  <span className="ml-4 shrink-0 transition-transform duration-200 group-open:rotate-180">
                    ▼
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Primary CTA Block */}
      <section className="mt-20 rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-brand-accent/5 p-8 text-center shadow-subtle sm:p-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("ctaTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t("ctaSubtitle")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={`/contact?service=${service.slug}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            <span>{t("requestProposal")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/services"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
          >
            {t("backToServices")}
          </Link>
        </div>
      </section>

      {/* Recommended Other Services */}
      <section className="mt-20" aria-labelledby="other-services-heading">
        <div className="flex items-center justify-between">
          <h2 id="other-services-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
            {t("exploreMore")}
          </h2>
          <Link
            href="/services"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("backToServices")} →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {otherServices.map((other) => {
            const otherName = locale === "bn" ? other.name_bn : other.name_en;
            const otherSummary = locale === "bn" ? other.summary_bn : other.summary_en;
            const OtherIcon = iconMap[other.icon] || Globe;
            return (
              <Card
                key={other.slug}
                className="flex flex-col border-border/70 bg-card transition-all hover:border-primary/50 hover:shadow-subtle"
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <OtherIcon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {modelLabels[other.pricing_model] || other.pricing_model}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-bold">{otherName}</CardTitle>
                  <CardDescription className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {otherSummary}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-2">
                  <Link
                    href={`/services/${other.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline"
                  >
                    <span>{locale === "bn" ? "বিস্তারিত দেখুন" : "View Details"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
