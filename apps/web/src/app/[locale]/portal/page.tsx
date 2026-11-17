import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Briefcase, Calendar, Clock, Flag, Layers, Sparkles } from "lucide-react";
import { routing } from "@/i18n/routing";
import { fetchClientProjects, fetchUpcomingClientAppointment } from "@/lib/portal/portal-server";
import { calculateClientProgress } from "@/lib/portal/portal-calc";
import { toBanglaDigits } from "@/lib/money";
import { UpcomingAppointmentCard } from "@/components/portal";

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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {isBn ? "আমার প্রজেক্টসমূহ" : "Client Projects"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isBn
            ? "আপনার সক্রিয় ও সম্পন্ন প্রজেক্টের রিয়েল-টাইম অগ্রগতি, লাইভ প্রিভিউ এবং ইনভয়েস।"
            : "Real-time read-only access to milestone progress, live previews, and billing schedules."}
        </p>
      </div>

      {query.invite === "accepted" ? (
        <p className="auth-message auth-success" role="status">
          {t("inviteAccepted")}
        </p>
      ) : null}

      {upcomingAppointment ? (
        <UpcomingAppointmentCard appointment={upcomingAppointment} locale={isBn ? "bn" : "en"} />
      ) : null}

      <section aria-labelledby="portal-start-title" className="space-y-4">
        <div>
          <h2 id="portal-start-title" className="text-xl font-bold text-foreground">
            {isBn ? "আপনার পরবর্তী প্রজেক্ট শুরু করুন" : "Start your next project"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isBn
              ? "আপনার জন্য উপযুক্ত সেবা খুঁজুন, বিস্তারিত দেখুন এবং প্রস্তাবনার অনুরোধ পাঠান।"
              : "Find the right service, compare your options, and send us a proposal request."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/services#service-finder" className="group rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/50">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
            <h3 className="mt-3 font-bold text-foreground">{isBn ? "সার্ভিস ফাইন্ডার" : "Service Finder"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isBn ? "কয়েকটি প্রশ্নের উত্তর দিয়ে আপনার জন্য সেরা সেবা খুঁজুন।" : "Answer a few questions to find your best-fit service."}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              {isBn ? "সেবা খুঁজুন" : "Find a service"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
          <Link href="/services" className="group rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/50">
            <Layers className="h-6 w-6 text-primary" aria-hidden="true" />
            <h3 className="mt-3 font-bold text-foreground">{isBn ? "সব সেবা দেখুন" : "Browse services"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isBn ? "সেবার বিবরণ ও প্রারম্ভিক মূল্য দেখে আপনার পছন্দটি বেছে নিন।" : "Review service details and starting prices before you choose."}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              {isBn ? "সেবা দেখুন" : "Explore services"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        </div>
        <Link href="/contact?proposal=1" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {isBn ? "প্রস্তাবনার অনুরোধ করুন" : "Request a proposal"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {/* Projects Grid or Empty State */}
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center max-w-lg mx-auto">
          <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h2 className="text-base font-bold text-foreground">
            {isBn ? "কোনো প্রজেক্ট খুঁজে পাওয়া যায়নি" : "No Active Projects Assigned"}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {isBn
              ? "এখনো কোনো প্রজেক্ট যুক্ত হয়নি। উপরের সার্ভিস ফাইন্ডার বা সেবা তালিকা থেকে পছন্দ করে প্রস্তাবনার অনুরোধ করুন।"
              : "No projects are assigned yet. Use the Service Finder or browse services above, then request a proposal to get started."}
          </p>
          <Link
            href="/services#service-finder"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
          >
            <span>{isBn ? "সেবা খুঁজুন" : "Find a service"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((project) => {
          const progressPercent = calculateClientProgress(project.milestones);
          const isCompleted = project.status === "completed";
          const visibleCount = project.milestones.filter((m) => m.isClientVisible).length;

          return (
            <div
              key={project.id}
              className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {project.companyName}
                    </span>
                    <h2 className="text-lg font-bold text-foreground tracking-tight leading-snug">
                      {project.title}
                    </h2>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
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

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {project.description}
                </p>

                {/* Progress bar preview */}
                <div className="space-y-1.5 rounded-xl bg-muted/40 p-3.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">
                      {isBn ? "সার্বিক অগ্রগতি" : "Overall Progress"}
                    </span>
                    <span className="font-mono font-bold text-primary">
                      {isBn ? toBanglaDigits(progressPercent) : progressPercent}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted ? "bg-emerald-500" : "bg-primary"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{project.currentStage}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Flag className="h-3 w-3" />
                      <span>
                        {isBn ? toBanglaDigits(visibleCount) : visibleCount} {isBn ? "মাইলফলক" : "Milestones"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Link */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{project.targetCompletionDate}</span>
                </div>

                <Link
                  href={`/portal/projects/${project.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <span>{isBn ? "বিস্তারিত দেখুন" : "View Project"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
}
