import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/guards";

export default async function PortalLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await requireUser(locale);
  return children;
}
