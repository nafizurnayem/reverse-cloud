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
  CheckCircle2,
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

const SECTION_PRIORITIES: Record<string, string> = {
  leads: "P1",
  projects: "P1",
  clients: "P2",
  payments: "P2",
  content: "P3",
  reviews: "P3",
  estimator: "P3",
  meetings: "P3",
  staff: "P4",
  audit: "P4",
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

  return (
    <div className="admin-page ph-window">
      {/* ── Window Title Bar & Window Controls ── */}
      <div className="ph-window-bar">
        <div className="ph-window-identity">
          <span className="ph-status-indicator" aria-hidden="true" />
          <span className="ph-window-title">workspace.reverse-cloud.internal</span>
        </div>
        <div className="ph-window-controls" aria-hidden="true">
          <span className="ph-win-btn ph-win-close" title="Close" />
          <span className="ph-win-btn ph-win-minimize" title="Minimize" />
          <span className="ph-win-btn ph-win-maximize" title="Maximize" />
        </div>
      </div>

      {/* ── Window Hero Section ── */}
      <div className="ph-hero">
        <div className="ph-hero-left">
          <h1 className="ph-hero-heading">
            Welcome to your workplace, <span className="ph-context-layer">{displayName}</span>
          </h1>
        </div>

        {/* ── Floating Setup Card (PostHog Style) ── */}
        <aside className="ph-setup-card" aria-label="System status">
          <div className="ph-setup-header">
            <strong>Set up ⚡ workspace</strong>
          </div>
          <ul className="ph-setup-checklist">
            <li>
              <CheckCircle2 size={15} className="ph-check-icon" aria-hidden="true" />
              <span>Database security guards online</span>
            </li>
            <li>
              <CheckCircle2 size={15} className="ph-check-icon" aria-hidden="true" />
              <span>{access.permissions.length} active permissions verified</span>
            </li>
            <li>
              <CheckCircle2 size={15} className="ph-check-icon" aria-hidden="true" />
              <span>Automated audit logging enabled</span>
            </li>
          </ul>
          <div className="ph-setup-actions">
            <Link href={`${dashboardPath}/leads`} className="ph-btn-primary">
              Open leads
            </Link>
            <Link href={`${dashboardPath}/staff`} className="ph-btn-secondary">
              Staff access
            </Link>
          </div>
        </aside>
      </div>

      {/* ── Segmented Tab Switcher (PostHog Style) ── */}
      <div className="ph-tabs-bar" role="tablist">
        <button type="button" className="ph-tab ph-tab-active" role="tab" aria-selected="true">
          Available Modules ({sections.length})
        </button>
        <button type="button" className="ph-tab" role="tab" aria-selected="false">
          Ask Reverse Cloud
        </button>
        <button type="button" className="ph-tab" role="tab" aria-selected="false">
          Give agents context
        </button>
      </div>

      {/* ── Box containing all Available Modules (PostHog Blue-Border Container) ── */}
      <div className="ph-showcase-container">
        {sections.length ? (
          <div className="admin-card-grid">
            {sections.map((section) => {
              const Icon = SECTION_ICONS[section.slug] ?? Layers;
              const priority = SECTION_PRIORITIES[section.slug] ?? "P3";

              return (
                <Link
                  className="admin-card ph-card"
                  href={`${dashboardPath}/${section.slug}`}
                  key={section.slug}
                >
                  <div className="ph-card-top-row">
                    <span className={`ph-p-badge ph-p-badge--${priority.toLowerCase()}`}>
                      {priority}
                    </span>
                    <code className="ph-card-code">{section.slug}</code>
                    <span className="ph-card-status">● Active</span>
                  </div>

                  <div className="admin-card-header-row">
                    <span className="admin-card-icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={1.85} />
                    </span>
                    <h3>{t(`sections.${section.slug}.title`)}</h3>
                  </div>

                  <p>{t(`sections.${section.slug}.description`)}</p>

                  <span className="admin-card-link">
                    <span>{t("open")}</span>
                    <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="admin-empty">{t("noTools")}</p>
        )}
      </div>
    </div>
  );
}
