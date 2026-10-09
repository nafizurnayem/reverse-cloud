"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("LanguageSwitcher");

  return (
    <nav className="language-switcher" aria-label={t("label")}>
      {routing.locales.map((language) => (
        <Link
          key={language}
          href={pathname}
          locale={language}
          lang={language}
          aria-current={locale === language ? "true" : undefined}
        >
          {t(language)}
        </Link>
      ))}
    </nav>
  );
}
