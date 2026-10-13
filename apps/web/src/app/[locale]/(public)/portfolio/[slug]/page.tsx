import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAllPortfolioSlugs,
  getPortfolioItemBySlug,
  PORTFOLIO_CATALOG,
} from "@/lib/portfolio-catalog";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ExternalLink,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";


type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  const slugs = getAllPortfolioSlugs();
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

  const item = await getPortfolioItemBySlug(slug);
  if (!item) return { title: "Case Study Not Found" };

  const title = locale === "bn" ? item.title_bn : item.title_en;
  const summary = locale === "bn" ? item.summary_bn : item.summary_en;

  return {
    title: `${title} — Reverse Cloud`,
    description: summary,
    openGraph: {
      title: `${title} — Reverse Cloud`,
      description: summary,
      type: "article",
    },
  };
}

export default async function PortfolioDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, item] = await Promise.all([
    getTranslations({ locale, namespace: "Portfolio" }),
    getPortfolioItemBySlug(slug),
  ]);

  if (!item) {
    notFound();
  }

  const title = locale === "bn" ? item.title_bn : item.title_en;
  const summary = locale === "bn" ? item.summary_bn : item.summary_en;
  const challenge = locale === "bn" ? item.challenge_bn : item.challenge_en;
  const solution = locale === "bn" ? item.solution_bn : item.solution_en;
  const result = locale === "bn" ? item.result_bn : item.result_en;

  const others = PORTFOLIO_CATALOG.filter((p) => p.slug !== item.slug).slice(0, 2);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      {/* Back button */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("backToPortfolio")}</span>
        </Link>
      </nav>

      {/* Case Study Hero */}
      <header className="rounded-2xl border border-border/70 bg-gradient-to-b from-card to-background p-6 shadow-sm sm:p-10 lg:p-12">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-brand-accent/50 bg-brand-accent/10 text-primary font-mono text-xs uppercase">
              {item.category}
            </Badge>
            {item.is_featured && (
              <Badge className="bg-primary text-primary-foreground font-semibold">
                <Sparkles className="mr-1 h-3 w-3" />
                {t("featuredBadge")}
              </Badge>
            )}
            {item.public_client_name && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                {t("clientLabel")}: {item.public_client_name}
              </span>
            )}
            {item.completed_on && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {t("completedLabel")}: {item.completed_on}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            {title}
          </h1>

          <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {summary}
          </p>

          {item.live_url && (
            <div className="pt-2">
              <a
                href={item.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
              >
                <span>{t("visitLive")}</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>

        {/* Quantifiable metrics grid */}
        {item.metrics && item.metrics.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-4 border-t border-border/60 pt-6 sm:grid-cols-3">
            {item.metrics.map((m, idx) => (
              <div key={idx} className="rounded-xl border border-border/70 bg-card p-4 text-center">
                <div className="text-2xl font-extrabold text-foreground sm:text-3xl">{m.value}</div>
                <div className="mt-1 text-xs font-medium text-muted-foreground">
                  {locale === "bn" ? m.label_bn : m.label_en}
                </div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Main Narrative: Challenge, Solution, Result */}
      <div className="mt-12 space-y-10">
        {/* The Challenge */}
        {challenge && (
          <section className="rounded-xl border border-border/70 bg-card p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("challengeTitle")}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {challenge}
            </p>
          </section>
        )}

        {/* Our Solution & Architecture */}
        {solution && (
          <section className="rounded-xl border border-border/70 bg-card p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("solutionTitle")}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {solution}
            </p>
          </section>
        )}

        {/* Measurable Results & Impact */}
        {result && (
          <section className="rounded-xl border border-border/70 bg-card p-6 sm:p-8">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" />
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {t("resultsTitle")}
              </h2>
            </div>
            <p className="mt-3 text-base leading-relaxed text-foreground/90 sm:text-lg font-medium">
              {result}
            </p>
          </section>
        )}

        {/* Tech Stack */}
        {item.tech_stack && item.tech_stack.length > 0 && (
          <section className="rounded-xl border border-border/70 bg-card p-6 sm:p-8">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {t("techStackTitle")}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.tech_stack.map((tech) => (
                <Badge
                  key={tech}
                  variant="secondary"
                  className="px-3 py-1 font-mono text-xs font-medium"
                >
                  {tech}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Primary CTA Block */}
      <section className="mt-16 rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-brand-accent/5 p-8 text-center shadow-subtle sm:p-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("ctaTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t("ctaSubtitle")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/contact"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            <span>{t("startProject")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/portfolio"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
          >
            {t("backToPortfolio")}
          </Link>
        </div>
      </section>

      {/* Other Case Studies */}
      {others.length > 0 && (
        <section className="mt-16" aria-labelledby="other-case-studies-heading">
          <h2 id="other-case-studies-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
            {locale === "bn" ? "আরও কেস স্টাডি" : "More Case Studies"}
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {others.map((other) => {
              const otherTitle = locale === "bn" ? other.title_bn : other.title_en;
              const otherSummary = locale === "bn" ? other.summary_bn : other.summary_en;
              return (
                <Card
                  key={other.slug}
                  className="flex flex-col border-border/70 bg-card transition-all hover:border-primary/50"
                >
                  <CardHeader className="space-y-2">
                    <Badge variant="outline" className="w-fit text-xs font-mono uppercase">
                      {other.category}
                    </Badge>
                    <CardTitle className="text-lg font-bold">{otherTitle}</CardTitle>
                    <CardDescription className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {otherSummary}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto pt-2">
                    <Link
                      href={`/portfolio/${other.slug}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>{t("viewCaseStudy")}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
