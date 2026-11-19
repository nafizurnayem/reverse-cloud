import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Layers, Shield } from "lucide-react";
import { routing } from "@/i18n/routing";
import { fetchClientProjectById, fetchProjectReview } from "@/lib/portal/portal-server";
import { formatBdt, formatUsd } from "@/lib/money";
import {
  ActivityFeed,
  LivePreviewCard,
  MilestoneTimeline,
  PaymentSchedule,
  ProjectProgressBar,
  ProjectReviewCard,
} from "@/components/portal";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const isBn = locale === "bn";
  const [project, existingReview] = await Promise.all([
    fetchClientProjectById(id),
    fetchProjectReview(id),
  ]);
  if (!project) notFound();

  const isCompleted = project.status === "completed";

  return (
    <div className="space-y-8">
      {/* Breadcrumb — back link only, no duplicate Read-Only badge */}
      <div className="flex items-center gap-3 border-b pb-4">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{isBn ? "সকল প্রজেক্টে ফিরে যান" : "Back to Projects"}</span>
        </Link>
      </div>

      {/* Project Hero */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 space-y-4">
          {/* Company label above title */}
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {project.companyName}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
            {project.title}
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            {project.description}
          </p>

          {/* 3 inline stat chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isCompleted
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              {isCompleted
                ? (isBn ? "সম্পন্ন" : "Completed")
                : (isBn ? "সক্রিয়" : "Active")}
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border px-3 py-1 text-xs font-semibold text-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" />
              {project.currentStage}
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border px-3 py-1 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {project.targetCompletionDate}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar — full width */}
      <ProjectProgressBar project={project} locale={locale} />

      {/* Main Grid: 2-col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Milestones + Payments */}
        <div className="lg:col-span-2 space-y-8">
          <MilestoneTimeline milestones={project.milestones} locale={locale} />
          <PaymentSchedule project={project} locale={locale} />
          <ProjectReviewCard
            projectId={project.id}
            locale={locale}
            clientName={project.clientName}
            companyName={project.companyName}
            existingReview={existingReview}
          />
        </div>

        {/* Right Column: Preview + Specs + Activity */}
        <div className="space-y-6">
          <LivePreviewCard
            previewUrl={project.livePreviewUrl}
            projectTitle={project.title}
            locale={locale}
          />

          {/* Project Specifications */}
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
