import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BLOG_CATALOG,
  getAllBlogSlugs,
  getBlogPostBySlug,
} from "@/lib/blog-catalog";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  User,
} from "lucide-react";


type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  const slugs = getAllBlogSlugs();
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

  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Article Not Found" };

  const title = locale === "bn" ? post.title_bn : post.title_en;
  const excerpt = locale === "bn" ? post.excerpt_bn : post.excerpt_en;

  return {
    title: `${title} — Reverse Cloud`,
    description: excerpt,
    openGraph: {
      title: `${title} — Reverse Cloud`,
      description: excerpt,
      type: "article",
      publishedTime: post.published_at,
    },
  };
}

export default async function BlogPostDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, post] = await Promise.all([
    getTranslations({ locale, namespace: "Blog" }),
    getBlogPostBySlug(slug),
  ]);

  if (!post) {
    notFound();
  }

  const title = locale === "bn" ? post.title_bn : post.title_en;
  const excerpt = locale === "bn" ? post.excerpt_bn : post.excerpt_en;
  const body = locale === "bn" ? post.body_bn : post.body_en;

  const others = BLOG_CATALOG.filter((b) => b.slug !== post.slug).slice(0, 2);

  // Render paragraphs and sections cleanly
  const paragraphs = body.split("\n\n");

  return (
    <article className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
      {/* Back button */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("backToBlog")}</span>
        </Link>
      </nav>

      {/* Header */}
      <header className="space-y-6 border-b border-border/70 pb-10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-mono text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {t("readTime", { minutes: post.read_time_minutes })}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {post.published_at.slice(0, 10)}
          </span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl leading-tight">
          {title}
        </h1>

        <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {excerpt}
        </p>

        {/* Author metadata */}
        <div className="flex items-center gap-3 pt-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary font-bold">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{post.author.name}</div>
            <div className="text-xs text-muted-foreground">
              {locale === "bn" ? post.author.role_bn : post.author.role_en}
            </div>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <div className="mt-10 space-y-6 text-foreground/90">
        {paragraphs.map((para, idx) => {
          const trimmed = para.trim();
          if (trimmed.startsWith("### ")) {
            return (
              <h2 key={idx} className="mt-8 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {trimmed.replace("### ", "")}
              </h2>
            );
          }
          if (trimmed.startsWith("```")) {
            const lines = trimmed.split("\n");
            const code = lines.slice(1, -1).join("\n");
            return (
              <pre key={idx} className="overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-4 font-mono text-xs text-foreground sm:text-sm">
                <code>{code}</code>
              </pre>
            );
          }
          if (trimmed.startsWith("1. ") || trimmed.startsWith("১. ")) {
            const listItems = trimmed.split("\n");
            return (
              <ol key={idx} className="list-decimal space-y-2 pl-6 text-base leading-relaxed text-foreground/90 sm:text-lg">
                {listItems.map((li, i) => (
                  <li key={i}>{li.replace(/^[0-9১-৯]+\.\s*/, "")}</li>
                ))}
              </ol>
            );
          }
          if (trimmed.startsWith("- ")) {
            const listItems = trimmed.split("\n");
            return (
              <ul key={idx} className="list-disc space-y-2 pl-6 text-base leading-relaxed text-foreground/90 sm:text-lg">
                {listItems.map((li, i) => (
                  <li key={i}>{li.replace(/^-\s*/, "")}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={idx} className="text-base leading-relaxed text-foreground/90 sm:text-lg">
              {trimmed}
            </p>
          );
        })}
      </div>

      {/* Article CTA Banner */}
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
            <span>{t("contactUs")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/blog"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
          >
            {t("backToBlog")}
          </Link>
        </div>
      </section>

      {/* More Articles */}
      {others.length > 0 && (
        <section className="mt-16 border-t border-border/60 pt-10" aria-labelledby="more-articles-heading">
          <h2 id="more-articles-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
            {locale === "bn" ? "আরও নিবন্ধ" : "More Articles"}
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {others.map((other) => {
              const otherTitle = locale === "bn" ? other.title_bn : other.title_en;
              const otherExcerpt = locale === "bn" ? other.excerpt_bn : other.excerpt_en;
              return (
                <Card
                  key={other.slug}
                  className="flex flex-col border-border/70 bg-card transition-all hover:border-primary/50"
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t("readTime", { minutes: other.read_time_minutes })}
                      </span>
                    </div>
                    <CardTitle className="text-lg font-bold">{otherTitle}</CardTitle>
                    <CardDescription className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {otherExcerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto pt-2">
                    <Link
                      href={`/blog/${other.slug}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>{t("readArticle")}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
