import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";

export function Footer({ accountHref = null }: { accountHref?: string | null }) {
  const t = useTranslations("Footer");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border/60 bg-card/60 text-foreground transition-colors">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand info */}
          <div className="space-y-4 md:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-lg bg-[#b8dc6f] font-extrabold text-[#15261f]"
                aria-hidden="true"
              >
                R
              </span>
              <span className="text-lg font-bold">{t("brand")}</span>
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("description")}
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("linksHeading")}
            </h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-1">
              <li>
                <Link
                  href="/"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("home")}
                </Link>
              </li>
              <li>
                <Link
                  href="/services"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("services")}
                </Link>
              </li>
              <li>
                <Link
                  href="/portfolio"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("portfolio")}
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("pricing")}
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("blog")}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("about")}
                </Link>
              </li>
              <li>
                <Link
                  href="/wizard"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("wizard")}
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("contact")}
                </Link>
              </li>
              <li>
                <Link
                  href={accountHref ?? "/login"}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {accountHref ? t(accountHref.endsWith("/admin") || accountHref.endsWith("/portal") ? "dashboard" : "account") : t("login")}
                </Link>
              </li>
            </ul>
          </div>


          {/* Services */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("servicesHeading")}
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/services/website-development"
                  className="transition-colors hover:text-foreground"
                >
                  {t("webDev")}
                </Link>
              </li>
              <li>
                <Link
                  href="/services/ai-chatbots-agents"
                  className="transition-colors hover:text-foreground"
                >
                  {t("aiSolutions")}
                </Link>
              </li>
              <li>
                <Link
                  href="/services/ai-automation"
                  className="transition-colors hover:text-foreground"
                >
                  {t("automation")}
                </Link>
              </li>
              <li>
                <Link
                  href="/services/software-development"
                  className="transition-colors hover:text-foreground"
                >
                  {t("scraping")}
                </Link>
              </li>

            </ul>
          </div>
        </div>

        <Separator className="my-8 opacity-60" />

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {currentYear} {t("brand")}. {t("rights")}
          </p>
          <div className="flex items-center gap-6">
            <Link href="/contact" className="transition-colors hover:text-foreground">
              {t("contact")}
            </Link>
            <Link href="/services" className="transition-colors hover:text-foreground">
              {t("services")}
            </Link>
            <Link href={accountHref ?? "/login"} className="transition-colors hover:text-foreground">
              {accountHref ? t(accountHref.endsWith("/admin") || accountHref.endsWith("/portal") ? "dashboard" : "account") : t("login")}
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">{t("privacy")}</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">{t("terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
