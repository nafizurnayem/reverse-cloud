import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { WizardContainer } from "@/components/wizard/wizard-container";
import { getWizardQuestions } from "@/lib/wizard-server";
import { Sparkles } from "lucide-react";


type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Wizard" });
  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
  };
}

export default async function WizardPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, questions] = await Promise.all([
    getTranslations({ locale, namespace: "Wizard" }),
    getWizardQuestions(),
  ]);

  const labels = {
    stepLabel: t("stepLabel"),
    multiHint: t("multiHint"),
    next: t("next"),
    back: t("back"),
    calculate: t("calculate"),
    restart: t("restart"),
    resultsTitle: t("resultsTitle"),
    resultsSubtitle: t("resultsSubtitle"),
    matchLabel: t("matchLabel"),
    startingFrom: t("startingFrom"),
    customQuote: t("customQuote"),
    viewService: t("viewService"),
    requestService: t("requestService"),
    ctaTitle: t("ctaTitle"),
    ctaSubtitle: t("ctaSubtitle"),
    contactUs: t("contactUs"),
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      {/* Hero section */}
      <div className="mx-auto max-w-3xl text-center mb-12">
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

      {/* Interactive Wizard Container */}
      <WizardContainer
        questions={questions}
        locale={locale}
        labels={labels}
      />
    </div>
  );
}
