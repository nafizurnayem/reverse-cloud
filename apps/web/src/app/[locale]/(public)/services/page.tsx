import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Services" });
  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
  };
}

export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Services" });

  const services = [
    {
      id: "web-dev",
      title: t("web.title"),
      badge: t("web.badge"),
      description: t("web.description"),
      features: [t("web.feature1"), t("web.feature2"), t("web.feature3")],
    },
    {
      id: "ai",
      title: t("ai.title"),
      badge: t("ai.badge"),
      description: t("ai.description"),
      features: [t("ai.feature1"), t("ai.feature2"), t("ai.feature3")],
    },
    {
      id: "automation",
      title: t("automation.title"),
      badge: t("automation.badge"),
      description: t("automation.description"),
      features: [t("automation.feature1"), t("automation.feature2"), t("automation.feature3")],
    },
    {
      id: "scraping",
      title: t("scraping.title"),
      badge: t("scraping.badge"),
      description: t("scraping.description"),
      features: [t("scraping.feature1"), t("scraping.feature2"), t("scraping.feature3")],
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      {/* Hero section */}
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="outline" className="mb-4 border-brand-accent/50 bg-brand-accent/10 text-primary">
          {t("hero.eyebrow")}
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          {t("hero.title")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {t("hero.description")}
        </p>
      </div>

      {/* Services Grid */}
      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
        {services.map((service) => (
          <Card
            key={service.id}
            id={service.id}
            className="flex flex-col border-border/70 bg-card transition-all hover:border-primary/50 hover:shadow-md"
          >
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="font-medium">
                  {service.badge}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold">{service.title}</CardTitle>
              <CardDescription className="text-base leading-relaxed text-muted-foreground">
                {service.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-3 pt-4">
              <ul className="space-y-2.5 text-sm text-foreground/90">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Call to action section */}
      <div className="mt-20 rounded-2xl border border-border/80 bg-gradient-to-b from-card to-muted/30 p-8 text-center shadow-subtle sm:p-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("cta.title")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t("cta.description")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
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
