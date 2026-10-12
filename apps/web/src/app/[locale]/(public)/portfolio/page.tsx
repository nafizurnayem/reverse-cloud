import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPortfolioItems } from "@/lib/portfolio-catalog";
import {
  ArrowRight,
  Calendar,
  ExternalLink,
  Sparkles,
  UserCheck,
} from "lucide-react";


type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Portfolio" });
  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
  };
}

export default async function PortfolioPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, items] = await Promise.all([
    getTranslations({ locale, namespace: "Portfolio" }),
    getPortfolioItems(),
  ]);

  const featured = items.find((item) => item.is_featured);

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

      {/* Featured Case Study Hero Banner */}
      {featured && (
        <div className="mt-16">
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-brand-accent/10 p-6 shadow-md sm:p-10 lg:p-12">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge className="bg-primary text-primary-foreground font-semibold">
                <Sparkles className="mr-1 h-3 w-3" />
                {t("featuredBadge")}
              </Badge>
              {featured.public_client_name && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  {featured.public_client_name}
                </span>
              )}
            </div>

            <div className="mt-4 max-w-3xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                {locale === "bn" ? featured.title_bn : featured.title_en}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {locale === "bn" ? featured.summary_bn : featured.summary_en}
              </p>
            </div>

            {/* Metrics pills if present */}
            {featured.metrics && (
              <div className="mt-6 flex flex-wrap gap-4 border-y border-border/60 py-4">
                {featured.metrics.map((m, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="text-xl font-extrabold text-foreground sm:text-2xl">{m.value}</span>
                    <span className="text-xs text-muted-foreground">{locale === "bn" ? m.label_bn : m.label_en}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-1.5">
                {featured.tech_stack.map((tech) => (
                  <Badge key={tech} variant="secondary" className="font-mono text-xs">
                    {tech}
                  </Badge>
                ))}
              </div>

              <Link
                href={`/portfolio/${featured.slug}`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                <span>{t("viewCaseStudy")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Case Studies Grid */}
      <div className="mt-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {items.map((item) => {
            const title = locale === "bn" ? item.title_bn : item.title_en;
            const summary = locale === "bn" ? item.summary_bn : item.summary_en;

            return (
              <Card
                key={item.slug}
                id={item.slug}
                className="group flex flex-col border-border/70 bg-card transition-all hover:border-primary/50 hover:shadow-md"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-xs uppercase">
                      {item.category}
                    </Badge>
                    {item.completed_on && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {item.completed_on}
                      </span>
                    )}
                  </div>

                  <CardTitle className="text-xl font-bold leading-snug group-hover:text-primary transition-colors">
                    {title}
                  </CardTitle>

                  {item.public_client_name && (
                    <span className="text-xs font-medium text-primary/90">
                      {t("clientLabel")}: {item.public_client_name}
                    </span>
                  )}

                  <CardDescription className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {summary}
                  </CardDescription>
                </CardHeader>

                {item.metrics && (
                  <div className="mx-6 grid grid-cols-3 gap-2 border-y border-border/60 py-3 text-center">
                    {item.metrics.map((m, idx) => (
                      <div key={idx} className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{m.value}</span>
                        <span className="text-[10px] text-muted-foreground">{locale === "bn" ? m.label_bn : m.label_en}</span>
                      </div>
                    ))}
                  </div>
                )}

                <CardContent className="mt-auto space-y-4 pt-4">
                  <div className="flex flex-wrap gap-1.5">
                    {item.tech_stack.slice(0, 4).map((tech) => (
                      <Badge key={tech} variant="secondary" className="font-mono text-[11px]">
                        {tech}
                      </Badge>
                    ))}
                    {item.tech_stack.length > 4 && (
                      <span className="text-xs text-muted-foreground">+{item.tech_stack.length - 4}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Link
                      href={`/portfolio/${item.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:underline"
                    >
                      <span>{t("viewCaseStudy")}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    {item.live_url && (
                      <a
                        href={item.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span>{t("visitLive")}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

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
            {t("startProject")}
          </Link>
          <Link
            href="/services"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
          >
            {t("exploreServices")}
          </Link>
        </div>
      </div>
    </div>
  );
}
