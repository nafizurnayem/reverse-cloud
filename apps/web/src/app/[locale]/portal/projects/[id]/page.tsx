import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { routing } from "@/i18n/routing";
import { fetchClientProjectById } from "@/lib/portal/portal-server";
import { formatBdt, formatUsd } from "@/lib/money";
import {
  ActivityFeed,
  LivePreviewCard,
  MilestoneTimeline,
  PaymentSchedule,
  ProjectProgressBar,
} from "@/components/portal";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const isBn = locale === "bn";
  const project = await fetchClientProjectById(id);
  if (!project) notFound();

  const isCompleted = project.status === "completed";

  return (
    <div className="space-y-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <Link
          href={`/${locale}/portal`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{isBn ? "সকল প্রজেক্টে ফিরে যান" : "Back to Projects"}</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Shield className="h-3 w-3 text-emerald-600" />
            <span>{isBn ? "রিড-অনলি মোড" : "Read-Only Mode"}</span>
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
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
      </div>

      {/* Project Overview Header */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {project.companyName}
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {project.title}
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          {project.description}
        </p>
      </div>

      {/* Progress Bar Component */}
      <ProjectProgressBar project={project} locale={locale} />

      {/* Main Grid: Milestones & Payments on Left, Preview & Activity on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Milestones & Payment Schedule */}
        <div className="lg:col-span-2 space-y-8">
          <MilestoneTimeline milestones={project.milestones} locale={locale} />
          <PaymentSchedule project={project} locale={locale} />
        </div>

        {/* Right Column: Live Preview & Activity Feed */}
        <div className="space-y-6">
          <LivePreviewCard
            previewUrl={project.livePreviewUrl}
            projectTitle={project.title}
            locale={locale}
          />

          {/* Project Metadata Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm text-card-foreground space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isBn ? "প্রজেক্টের বিবরণী" : "Project Specifications"}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">{isBn ? "ক্লায়েন্ট প্রতিনিধি:" : "Client Lead:"}</span>
                <span className="font-semibold text-foreground">{project.clientName}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">{isBn ? "মোট চুক্তি মূল্য:" : "Contract Value:"}</span>
                <div className="text-right font-mono">
                  <span className="font-bold text-foreground block">
                    {formatUsd(project.budgetUsd)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ≈ {formatBdt(project.budgetBdt)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">{isBn ? "শুরুর তারিখ:" : "Start Date:"}</span>
                <span className="font-mono text-foreground">{project.startDate}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{isBn ? "সমাপ্তির লক্ষ্য:" : "Target Delivery:"}</span>
                <span className="font-mono font-semibold text-foreground">
                  {project.targetCompletionDate}
                </span>
              </div>
            </div>
          </div>

          <ActivityFeed activity={project.activity} locale={locale} />
        </div>
      </div>
    </div>
  );
}
