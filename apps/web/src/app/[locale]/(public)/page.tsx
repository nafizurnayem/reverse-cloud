import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getApprovedReviews } from "@/lib/reviews-catalog";
import { TestimonialsSection } from "@/components/home/testimonials-section";

type Props = {
  params?: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale = "en" } = (await params) ?? {};
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Home" });
  return {
    title: `${t("brand")} — ${t("heading")}`,
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: "/en",
        bn: "/bn",
      },
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale = "en" } = (await params) ?? {};
  const [t, tFooter, reviews] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Footer" }),
    getApprovedReviews(locale),
  ]);

  const isBn = locale === "bn";
  const previews = [
    {
      title: tFooter("webDev"),
      desc: isBn
        ? "উচ্চ-গতির নেক্সট.জেএস ১৬ প্ল্যাটফর্ম—ফুল এসএসআর/এসএসজি, সুপাবেস আরএলএস এবং সমন্বিত বহુભাষিক সমর্থন সহ।"
        : "High-velocity Next.js 16 platforms with full SSR/SSG, Supabase RLS, and seamless i18n.",
      href: "/services/website-development",
    },
    {
      title: tFooter("aiSolutions"),
      desc: isBn
        ? "নির্দিষ্ট ডোমেইনের জন্য পাইড্যান্টিকএআই এজেন্ট, মূল্যায়ন বেঞ্চমার্ক এবং নিরাপদ এইচম্যাক-স্বাক্ষরিত এপিআই।"
        : "Domain-specific PydanticAI agents, evaluation benchmarks, and secure HMAC-signed APIs.",
      href: "/services/ai-chatbots-agents",
    },
    {
      title: tFooter("automation"),
      desc: isBn
        ? "ইভেন্ট-চালিত অটোমেশন, ওয়েবহুক সিঙ্ক্রোনাইজেশন এবং ব্যাকগ্রাউন্ড ওয়ার্কার কিউ।"
        : "Robust event-driven automations, webhook synchronization, and background worker queues.",
      href: "/services/ai-automation",
    },
    {
      title: tFooter("scraping"),
      desc: isBn
        ? "স্থিতিস্থাপক ডিস্ট্রিবিউটেড পাইথন ডেটা নিষ্কাশন পাইপলাইন এবং কাঠামোগত স্টোরেজ।"
        : "Resilient distributed Python data extraction pipelines with asyncpg and structured storage.",
      href: "/services/software-development",
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="landing relative overflow-hidden">
        <div className="flex flex-col items-start gap-4">
          <Badge variant="outline" className="border-brand-accent/40 bg-brand-accent/10 px-3 py-1 text-xs text-primary">
            <span className="eyebrow">{t("brand")}</span>
          </Badge>

          <h1>{t("heading")}</h1>

          <p className="description text-muted-foreground">{t("description")}</p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link
              href="/services"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
            >
              {t("exploreServices")}
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-semibold text-foreground shadow-subtle transition-all hover:bg-accent hover:text-accent-foreground"
            >
              {t("getStarted")}
            </Link>
          </div>

          <div className="status mt-8 flex items-center gap-2.5 rounded-lg border border-border/70 bg-card/60 px-4 py-2 text-sm text-muted-foreground shadow-subtle">
            <span className="h-2 w-2 rounded-full bg-[#b8dc6f] animate-pulse" aria-hidden="true" />
            <p>{t("status")}</p>
          </div>
        </div>
      </section>

      {/* Services Overview Teaser */}
      <section className="border-t border-border/60 bg-muted/20 py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">{t("servicesTitle")}</h2>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              {t("servicesSubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {previews.map((item, idx) => (
              <Card
                key={idx}
                className="flex flex-col border-border/70 bg-card transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-md"
              >
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-lg font-bold">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between p-5 pt-0">
                  <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                    {item.desc}
                  </CardDescription>
                  <Link
                    href={item.href}
                    className="mt-4 inline-flex items-center text-xs font-semibold text-primary hover:underline"
                  >
                    {t("exploreServices")} →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Client Testimonials Section */}
      <TestimonialsSection
        reviews={reviews}
        locale={locale}
        translations={{
          eyebrow: t("testimonialsEyebrow"),
          title: t("testimonialsTitle"),
          subtitle: t("testimonialsSubtitle"),
          verifiedClient: t("verifiedClient"),
          satisfactionScore: t("satisfactionScore"),
          satisfactionDesc: t("satisfactionDesc"),
          onTimeDelivery: t("onTimeDelivery"),
          onTimeDesc: t("onTimeDesc"),
        }}
      />

      {/* Engineering Principles Section */}
      <section className="py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 p-8 shadow-card sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("whyUsTitle")}</h2>
            <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
              {t("whyUsSubtitle")}
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-background/50 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">01. Architecture</span>
                <p className="mt-2 text-sm text-muted-foreground">
                  Type-safe Next.js + FastAPI microservices with strict schema boundaries.
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/50 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">02. Security</span>
                <p className="mt-2 text-sm text-muted-foreground">
                  Supabase Row Level Security, PKCE OAuth, and cryptographic HMAC service authentication.
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/50 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">03. Globalization</span>
                <p className="mt-2 text-sm text-muted-foreground">
                  First-class bilingual support with English & Bangla localization out of the box.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
