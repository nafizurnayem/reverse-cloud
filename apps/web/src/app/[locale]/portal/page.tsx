import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  Flag,
  Layers,
  Rocket,
  Sparkles,
} from "lucide-react";
import { routing } from "@/i18n/routing";
import { fetchClientProjects, fetchUpcomingClientAppointment } from "@/lib/portal/portal-server";
import { calculateClientProgress, calculatePaymentAlerts } from "@/lib/portal/portal-calc";
import { toBanglaDigits } from "@/lib/money";
import { PaymentAlert, UpcomingAppointmentCard } from "@/components/portal";

export default async function PortalProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "Portal" });
  const isBn = locale === "bn";
  const [projects, upcomingAppointment] = await Promise.all([
    fetchClientProjects(),
    fetchUpcomingClientAppointment(),
  ]);

  const hasProjects = projects.length > 0;
  const paymentAlert = calculatePaymentAlerts(projects);

  // Stats for active client view
  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status !== "completed").length;
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  const nextDeadline = projects
    .filter((p) => p.status !== "completed" && p.targetCompletionDate)
    .map((p) => p.targetCompletionDate)
    .sort()[0] ?? null;

  return (
    <div className="space-y-6">
      {query.invite === "accepted" ? (
        <p className="auth-message auth-success" role="status">
          {t("inviteAccepted")}
        </p>
      ) : null}

      {/* Payment Alert Banner (Overdue / Due Soon) */}
      <PaymentAlert alert={paymentAlert} locale={locale} />

      {/* ── EMPTY STATE (no projects) ─────────────────────────── */}
      {!hasProjects && (
        <div className="space-y-5">
          {/* Top Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                {isBn ? "আপনার ওয়ার্কস্পেস" : "Your Workspace"}
              </h1>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                {isBn
                  ? "আপনার ডেডিকেটেড কন্ট্রোল সেন্টার। নিচের যেকোনো অপশন ব্যবহার করে নতুন প্রজেক্ট শুরু বা সেবা বাছাই করুন।"
                  : "Your dedicated engineering hub. Launch the service finder, explore capabilities, or scope a new build."}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/schedule"
                className="group relative inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 group-hover:bg-primary-foreground"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary group-hover:bg-primary-foreground"></span>
                </span>
                <Calendar className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
                <span>{isBn ? "পরামর্শ শিডিউল করুন" : "Schedule Call"}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/contact?proposal=1"
                className="inline-flex items-center gap-1.5 rounded-xl border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
              >
                <Rocket className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{isBn ? "প্রস্তাবনা অনুরোধ" : "Request Proposal"}</span>
              </Link>
            </div>
          </div>

          {/* Appointment banner if scheduled */}
          {upcomingAppointment ? (
            <UpcomingAppointmentCard appointment={upcomingAppointment} locale={isBn ? "bn" : "en"} />
          ) : null}

          {/* 3 Core Interactive Cards (Zero Scroll, High Clarity) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Service Finder */}
            <Link
              href="/services#service-finder"
              className="group relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                    {isBn ? "স্মার্ট ম্যাচ" : "Smart Match"}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {isBn ? "সার্ভিস ফাইন্ডার" : "Service Finder"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {isBn
                      ? "৪টি টেকনিক্যাল প্রশ্নের উত্তর দিয়ে আপনার প্রজেক্টের জন্য সেরা স্থাপত্য ও বাজেটের রিকমেন্ডেশন পান।"
                      : "Answer 4 quick technical questions to match your workload with recommended architectures and pricing."}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold text-primary">
                <span>{isBn ? "ফাইন্ডার শুরু করুন" : "Launch Matcher"}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Card 2: Production Catalog */}
            <Link
              href="/services"
              className="group relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Layers className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-muted border px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {isBn ? "১১টি সেবা" : "11 Capabilities"}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {isBn ? "প্রযুক্তি ক্যাটালগ" : "Explore Capabilities"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {isBn
                      ? "ওয়েব, এজেন্টিক এআই, অটোমেশন এবং ডেটা স্ক্র্যাপিং সেবাসমূহের পূর্ণাঙ্গ টেক স্ট্যাক ও মূল্য তালিকা দেখুন।"
                      : "Review complete tech stacks, deliverables, SLA models, and starting rates across all engineering domains."}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold text-primary">
                <span>{isBn ? "সব সেবা দেখুন" : "Browse Services"}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Card 3: Custom Technical Proposal */}
            <Link
              href="/contact?proposal=1"
              className="group relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    {isBn ? "প্রস্তাবনা" : "Proposal"}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {isBn ? "কাস্টম প্রজেক্ট স্কোপ" : "Scope a Project"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {isBn
                      ? "আপনার সুনির্দিষ্ট চাহিদা বা পিআরডি জমা দিন; আমাদের সিনিয়র টিম মাইলফলক রোডম্যাপ ও কোট তৈরি করবে।"
                      : "Submit technical specs, PRDs, or repos to receive a structured milestone delivery schedule and fixed quote."}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold text-primary">
                <span>{isBn ? "প্রস্তাবনা পাঠান" : "Request Proposal"}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>

          {/* Quick Technical Architecture Consultation Ribbon */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <Cpu className="h-3.5 w-3.5" />
              </span>
              <span>
                {isBn
                  ? "নতুন প্রজেক্ট বা জটিল স্থাপত্য নিয়ে সরাসরি ইঞ্জিনিয়ারিং টিমের সাথে আলোচনা করতে চান?"
                  : "Need to evaluate system architecture, cloud deployment, or technical feasibility?"}
              </span>
            </div>
            <Link
              href="/schedule"
              className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline shrink-0"
            >
              <span>{isBn ? "টেকনিক্যাল কল শিডিউল করুন" : "Book Architecture Call"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ── ACTIVE STATE (has projects) ───────────────────────── */}
      {hasProjects && (
        <>
          {/* Page Header */}
          <div className="border-b pb-5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {isBn ? "আমার প্রজেক্টসমূহ" : "Client Projects"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isBn
                ? "আপনার সক্রিয় ও সম্পন্ন প্রজেক্টের রিয়েল-টাইম অগ্রগতি, লাইভ প্রিভিউ এবং ইনভয়েস।"
                : "Real-time read-only access to milestone progress, live previews, and billing schedules."}
            </p>
          </div>

          {/* Appointment card if any */}
          {upcomingAppointment ? (
            <UpcomingAppointmentCard appointment={upcomingAppointment} locale={isBn ? "bn" : "en"} />
          ) : null}

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: isBn ? "মোট প্রজেক্ট" : "Total Projects",
                value: isBn ? toBanglaDigits(totalProjects) : String(totalProjects),
                icon: <Briefcase className="h-4 w-4 text-primary" />,
                color: "bg-primary/10",
              },
              {
                label: isBn ? "সক্রিয়" : "Active",
                value: isBn ? toBanglaDigits(activeProjects) : String(activeProjects),
                icon: <Rocket className="h-4 w-4 text-primary" />,
                color: "bg-primary/10",
              },
              {
                label: isBn ? "সম্পন্ন" : "Completed",
                value: isBn ? toBanglaDigits(completedProjects) : String(completedProjects),
                icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
                color: "bg-emerald-500/10",
              },
              {
                label: isBn ? "পরবর্তী ডেডলাইন" : "Next Deadline",
                value: nextDeadline ?? (isBn ? "—" : "—"),
                icon: <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
                color: "bg-amber-500/10",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border bg-card p-4 shadow-sm flex flex-col gap-2"
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.color}`}>
                  {stat.icon}
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-extrabold tracking-tight text-foreground font-mono leading-tight">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project) => {
              const progressPercent = calculateClientProgress(project.milestones);
              const isCompleted = project.status === "completed";
              const visibleCount = project.milestones.filter((m) => m.isClientVisible).length;

              return (
                <div
                  key={project.id}
                  className="flex flex-col rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Card top: progress % hero */}
                  <div className="flex items-start gap-4 p-6 pb-4">
                    {/* Big % */}
                    <div
                      className={`shrink-0 flex flex-col items-center justify-center rounded-2xl w-20 h-20 border-2 ${
                        isCompleted
                          ? "border-emerald-500/40 bg-emerald-500/8"
                          : "border-primary/30 bg-primary/8"
                      }`}
                    >
                      <span
                        className={`text-2xl font-black font-mono leading-none ${
                          isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                        }`}
                      >
                        {isBn ? toBanglaDigits(progressPercent) : progressPercent}
                      </span>
                      <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">%</span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                            {project.companyName}
                          </span>
                          <h2 className="text-base font-bold text-foreground tracking-tight leading-snug line-clamp-1">
                            {project.title}
                          </h2>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                            isCompleted
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {isCompleted
                            ? (isBn ? "সম্পন্ন" : "Completed")
                            : (isBn ? "সক্রিয়" : "Active")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                        {project.description}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="px-6">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted ? "bg-emerald-500" : "bg-primary"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Stage chip + milestones */}
                  <div className="flex items-center gap-2 flex-wrap px-6 pt-3 pb-4">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-muted/50 border px-2.5 py-1 text-[11px] font-semibold text-foreground">
                      <Clock className="h-3 w-3 text-primary" />
                      {project.currentStage}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-muted/50 border px-2.5 py-1 text-[11px] text-muted-foreground">
                      <Flag className="h-3 w-3" />
                      {isBn ? toBanglaDigits(visibleCount) : visibleCount}{" "}
                      {isBn ? "মাইলফলক" : "Milestones"}
                    </span>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-6 py-3 border-t mt-auto">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{project.targetCompletionDate}</span>
                    </div>
                    <Link
                      href={`/portal/projects/${project.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>{isBn ? "বিস্তারিত দেখুন" : "View Details"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
