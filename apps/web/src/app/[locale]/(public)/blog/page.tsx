import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBlogPosts } from "@/lib/blog-catalog";
import {
  ArrowRight,
  Calendar,
  Clock,
  Sparkles,
  User,
} from "lucide-react";


type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Blog" });
  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
  };
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, posts] = await Promise.all([
    getTranslations({ locale, namespace: "Blog" }),
    getBlogPosts(),
  ]);

  const featured = posts[0];
  const remaining = posts.slice(1);

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

      {/* Featured Blog Post Banner */}
      {featured && (
        <div className="mt-16">
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-brand-accent/10 p-6 shadow-md sm:p-10 lg:p-12">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge className="bg-primary text-primary-foreground font-semibold">
                <Sparkles className="mr-1 h-3 w-3" />
                {t("featuredBadge")}
              </Badge>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {t("readTime", { minutes: featured.read_time_minutes })}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {featured.published_at.slice(0, 10)}
              </span>
            </div>

            <div className="mt-4 max-w-3xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                {locale === "bn" ? featured.title_bn : featured.title_en}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {locale === "bn" ? featured.excerpt_bn : featured.excerpt_en}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                  <User className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-foreground">{featured.author.name}</div>
                  <div className="text-muted-foreground">
                    {locale === "bn" ? featured.author.role_bn : featured.author.role_en}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {featured.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-mono text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <Link
                  href={`/blog/${featured.slug}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                >
                  <span>{t("readArticle")}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remaining Blog Posts Grid */}
      {remaining.length > 0 && (
        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {remaining.map((post) => {
              const title = locale === "bn" ? post.title_bn : post.title_en;
              const excerpt = locale === "bn" ? post.excerpt_bn : post.excerpt_en;

              return (
                <Card
                  key={post.slug}
                  id={post.slug}
                  className="group flex flex-col border-border/70 bg-card transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="font-mono text-[11px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {t("readTime", { minutes: post.read_time_minutes })}
                      </span>
                    </div>

                    <CardTitle className="text-xl font-bold leading-snug group-hover:text-primary transition-colors">
                      {title}
                    </CardTitle>

                    <CardDescription className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {excerpt}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="mt-auto space-y-4 pt-2">
                    <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {post.published_at.slice(0, 10)}
                      </span>
                      <span>{post.author.name}</span>
                    </div>

                    <div className="pt-1">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:underline"
                      >
                        <span>{t("readArticle")}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

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
            {t("viewServices")}
          </Link>
        </div>
      </div>
    </div>
  );
}
