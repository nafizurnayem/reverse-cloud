"use client";

import { Calendar, CheckCircle, Clock } from "lucide-react";
import type { PortalProject } from "@/lib/portal/types";
import { calculateClientProgress } from "@/lib/portal/portal-calc";
import { toBanglaDigits } from "@/lib/money";

interface ProjectProgressBarProps {
  project: PortalProject;
  locale: string;
}

export function ProjectProgressBar({ project, locale }: ProjectProgressBarProps) {
  const isBn = locale === "bn";
  const progressPercent = calculateClientProgress(project.milestones);
  const isCompleted = progressPercent === 100;

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm text-card-foreground space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isBn ? "প্রজেক্টের সামগ্রিক অগ্রগতি" : "Overall Project Progress"}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {isBn ? toBanglaDigits(progressPercent) : progressPercent}%
            </span>
            <span className="text-xs text-muted-foreground">
              {isCompleted
                ? (isBn ? "সম্পূর্ণ সম্পন্ন" : "Fully Completed")
                : (isBn ? "চলমান" : "In Progress")}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs text-foreground">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{project.currentStage}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {isBn ? "টার্গেট সমাপ্তি:" : "Target:"}{" "}
              <strong className="text-foreground">{project.targetCompletionDate}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-1.5">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-700 ease-out rounded-full ${
              isCompleted ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{isBn ? "শুরু:" : "Started:"} {project.startDate}</span>
          <span>{isBn ? "সমাপ্তি:" : "Target:"} {project.targetCompletionDate}</span>
        </div>
      </div>

      {isCompleted && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>
            {isBn
              ? "অভিনন্দন! এই প্রজেক্টের সমস্ত ক্লায়েন্ট মাইলফলক সফলভাবে সম্পন্ন ও হস্তান্তরিত হয়েছে।"
              : "All scheduled milestones have been successfully delivered and accepted."}
          </span>
        </div>
      )}
    </div>
  );
}
