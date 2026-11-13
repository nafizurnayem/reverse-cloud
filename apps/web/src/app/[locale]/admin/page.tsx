import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Star,
  Calculator,
  Inbox,
  Users,
  Briefcase,
  CreditCard,
  Calendar,
  ShieldCheck,
  Activity,
  Layers,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { routing } from "@/i18n/routing";
import { visibleAdminSections } from "@/lib/auth/admin-sections";
import { staffDashboardPath } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/guards";

const SECTION_ICONS: Record<string, LucideIcon> = {
  content: FileText,
  reviews: Star,
  estimator: Calculator,
  leads: Inbox,
  clients: Users,
  projects: Briefcase,
  payments: CreditCard,
  meetings: Calendar,
  staff: ShieldCheck,
  audit: Activity,
};

const SECTION_ACCENT: Record<string, string> = {
  content:   "indigo",
  reviews:   "amber",
  estimator: "violet",
  leads:     "sky",
  clients:   "emerald",
  projects:  "blue",
  payments:  "green",
  meetings:  "rose",
  staff:     "slate",
  audit:     "orange",
};

export default async function AdminPage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [{ user, access }, t] = await Promise.all([
    requireStaff(locale),
    getTranslations({ locale, namespace: "Admin" }),
  ]);
  const sections = visibleAdminSections(access.permissions);
  const dashboardPath = staffDashboardPath(access);

  const displayName =
    (typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata.name === "string" && user.user_metadata.name) ||
    user.email ||
    t("unknownUser");

  const firstName = typeof displayName === "string"
    ? displayName.split(" ")[0]
    : displayName;

  return (
    <main className="admin-page">
      {/* Welcome bar */}
      <div className="admin-welcome-bar">
        <div className="admin-welcome-text">
          <p className="admin-welcome-greeting">Welcome back, {firstName} 👋</p>
          <h1>{t("dashboard")}</h1>
          <p className="admin-welcome-sub">{t("accessDescription")}</p>
        </div>
        <div className="admin-welcome-meta">
          <span className="admin-section-count-badge">
            {sections.length} section{sections.length !== 1 ? "s" : ""} available
          </span>
        </div>
      </div>

      {sections.length ? (
        <div className="admin-card-grid">
          {sections.map((section) => {
            const Icon = SECTION_ICONS[section.slug] ?? Layers;
            const accent = SECTION_ACCENT[section.slug] ?? "indigo";
            return (
              <Link
                className={`admin-card admin-card--${accent}`}
                href={`${dashboardPath}/${section.slug}`}
                key={section.slug}
              >
                <div className="admin-card-top">
                  <span className="admin-card-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.85} />
                  </span>
                </div>
                <h3>{t(`sections.${section.slug}.title`)}</h3>
                <p>{t(`sections.${section.slug}.description`)}</p>
                <span className="admin-card-link">
                  {t("open")}
                  <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="admin-empty">{t("noTools")}</p>
      )}
    </main>
  );
}
