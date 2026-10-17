import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Calendar } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { fetchMeetingTypes, fetchSignedInClientPrefill } from "@/lib/schedule-server";
import { ScheduleView } from "@/components/schedule/schedule-view";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Schedule" });
  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
  };
}

export default async function SchedulePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, meetingTypes, prefill] = await Promise.all([
    getTranslations({ locale, namespace: "Schedule" }),
    fetchMeetingTypes(locale),
    fetchSignedInClientPrefill(),
  ]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16">
        <Badge
          variant="outline"
          className="mb-4 border-primary/30 bg-primary/10 text-primary px-3.5 py-1 text-xs font-semibold gap-1.5 shadow-sm"
        >
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span>{t("eyebrow")}</span>
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
          {t("title")}
        </h1>
        <p className="mt-4 text-base sm:text-lg leading-relaxed text-muted-foreground max-w-2xl mx-auto">
          {t("description")}
        </p>
      </div>

      {/* Main Schedule & Prefill View */}
      <ScheduleView
        meetingTypes={meetingTypes}
        prefill={prefill}
        locale={locale}
      />
    </div>
  );
}
