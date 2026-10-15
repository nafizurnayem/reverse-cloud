import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { LegalDocument, type LegalCopy } from "@/components/legal-document";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params; if (!hasLocale(routing.locales, locale)) notFound();
  const copy = (await getTranslations({ locale, namespace: "Legal" })).raw("privacy") as LegalCopy & { metadata: Metadata };
  return copy.metadata;
}
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params; if (!hasLocale(routing.locales, locale)) notFound();
  return <LegalDocument copy={(await getTranslations({ locale, namespace: "Legal" })).raw("privacy") as LegalCopy} />;
}
