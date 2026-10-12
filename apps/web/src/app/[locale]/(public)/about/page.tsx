import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Cpu,
  Globe,
  Layers,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "About" });
  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "About" });

  const pillars = [
    {
      icon: ShieldCheck,
      title: t("pillar1Title"),
      description: t("pillar1Desc"),
    },
    {
      icon: Cpu,
      title: t("pillar2Title"),
      description: t("pillar2Desc"),
    },
    {
      icon: Zap,
      title: t("pillar3Title"),
      description: t("pillar3Desc"),
    },
    {
      icon: Globe,
      title: t("pillar4Title"),
      description: t("pillar4Desc"),
    },
  ];

  const values = [
    {
      icon: Code2,
      title: t("value1Title"),
      description: t("value1Desc"),
    },
    {
      icon: CheckCircle2,
      title: t("value2Title"),
      description: t("value2Desc"),
    },
    {
      icon: Layers,
      title: t("value3Title"),
      description: t("value3Desc"),
    },
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

      {/* Engineering Pillars */}
      <section className="mt-20" aria-labelledby="pillars-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="pillars-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("pillarsTitle")}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t("pillarsSubtitle")}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <Card
                key={idx}
                className="flex flex-col border-border/70 bg-card transition-all hover:border-primary/50 hover:shadow-subtle"
              >
                <CardHeader className="space-y-3">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl font-bold">{pillar.title}</CardTitle>
                </CardHeader>
                <CardContent className="mt-auto text-sm leading-relaxed text-muted-foreground">
                  {pillar.description}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Engineering Standards / How We Work */}
      <section className="mt-24" aria-labelledby="values-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="values-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("valuesTitle")}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t("valuesSubtitle")}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {values.map((val, idx) => {
            const Icon = val.icon;
            return (
              <Card
                key={idx}
                className="flex flex-col border-border/70 bg-card/60 p-2 transition-all hover:border-primary/40"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg font-bold">{val.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto text-sm leading-relaxed text-muted-foreground">
                  {val.description}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Team Story Section */}
      <section className="mt-24 rounded-2xl border border-border/70 bg-card p-8 sm:p-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" />
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {t("teamTitle")}
              </h2>
            </div>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("teamDesc")}
            </p>
          </div>

          <div className="shrink-0">
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
            >
              <span>{t("viewPortfolio")}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
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
            {t("ctaButton")}
          </Link>
          <Link
            href="/portfolio"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
          >
            {t("viewPortfolio")}
          </Link>
        </div>
      </div>
    </div>
  );
}
