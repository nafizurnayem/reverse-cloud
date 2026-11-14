import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

const sansFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const bengaliFont = Noto_Sans_Bengali({
  subsets: ["bengali"],
  display: "swap",
  variable: "--font-bengali",
  weight: ["400", "500", "600", "700"],
});

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://revcloud.dev";
  const isBn = locale === "bn";
  const canonical = getPathname({ href: "/", locale });

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("title"),
      template: "%s | Reverse Cloud",
    },
    description: t("description"),
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: isBn ? "bn_BD" : "en_US",
      url: canonical,
      siteName: "Reverse Cloud",
      title: t("title"),
      description: t("description"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://revcloud.dev";
  const schemaOrg = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: "Reverse Cloud",
        url: siteUrl,
        logo: `${siteUrl}/icon.png`,
        description:
          "Full-stack web engineering, custom agentic AI systems, and cloud infrastructure.",
        sameAs: [
          "https://github.com/reverse-cloud",
          "https://linkedin.com/company/reverse-cloud",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        url: siteUrl,
        name: "Reverse Cloud",
        publisher: {
          "@id": `${siteUrl}#organization`,
        },
        inLanguage: [locale === "bn" ? "bn-BD" : "en-US"],
      },
    ],
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${sansFont.variable} ${bengaliFont.variable} ${
          locale === "bn" ? "font-bengali" : "font-sans"
        } antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
