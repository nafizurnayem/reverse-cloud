"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Flag,
  Search,
  X,
} from "lucide-react";
import type { PortalMilestone } from "@/lib/portal/types";
import { toBanglaDigits } from "@/lib/money";

interface MilestoneTimelineProps {
  milestones: PortalMilestone[];
  locale: string;
}

type FilterStatus = "all" | "in_progress" | "completed" | "upcoming";

export function MilestoneTimeline({ milestones, locale }: MilestoneTimelineProps) {
  const isBn = locale === "bn";
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Enforce rule: client sees ONLY isClientVisible = true milestones
  const visibleMilestones = useMemo(
    () => milestones.filter((m) => m.isClientVisible),
    [milestones],
  );

  const counts = useMemo(
    () => ({
      all: visibleMilestones.length,
      in_progress: visibleMilestones.filter(
        (m) => m.status === "in_progress" && m.progress < 100,
      ).length,
      completed: visibleMilestones.filter(
        (m) => m.status === "completed" || m.progress === 100,
      ).length,
      upcoming: visibleMilestones.filter(
        (m) => m.status === "upcoming" || (m.status !== "completed" && m.progress === 0),
      ).length,
    }),
    [visibleMilestones],
  );

  const filteredMilestones = useMemo(() => {
    return visibleMilestones.filter((m) => {
      const isDone = m.status === "completed" || m.progress === 100;
      const isInProg = m.status === "in_progress" && m.progress < 100;
      const isUp = !isDone && !isInProg;

      if (activeFilter === "in_progress" && !isInProg) return false;
      if (activeFilter === "completed" && !isDone) return false;
      if (activeFilter === "upcoming" && !isUp) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(query);
        const matchesDesc = (m.description || "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }, [visibleMilestones, activeFilter, searchQuery]);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm text-card-foreground space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Flag className="h-4 w-4 text-primary" />
            <span>{isBn ? "মাইলফলক টাইমলাইন" : "Milestone Timeline"}</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isBn
              ? "প্রজেক্টের প্রতিটি পর্যায়ের ওজন, অগ্রগতি এবং সময়সীমা"
              : "Detailed milestone weight, delivery progress, and schedule"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {isBn ? toBanglaDigits(visibleMilestones.length) : visibleMilestones.length}{" "}
            {isBn ? "মাইলফলক" : "Milestones"}
          </span>
        </div>
      </div>

      {/* Filter and Search Controls (User Feedback Improvement) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl border border-border/60">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" />
            <span className="sr-only sm:not-sr-only">{isBn ? "ফিল্টার:" : "Filter:"}</span>
          </span>

          {(
            [
              { key: "all", en: "All", bn: "সকল" },
              { key: "in_progress", en: "In Progress", bn: "চলমান" },
              { key: "completed", en: "Completed", bn: "সম্পন্ন" },
              { key: "upcoming", en: "Upcoming", bn: "আসন্ন" },
            ] as const
          ).map((tab) => {
            const isActive = activeFilter === tab.key;
            const count = counts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background text-muted-foreground hover:text-foreground border border-border/70"
                }`}
              >
                <span>{isBn ? tab.bn : tab.en}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isBn ? toBanglaDigits(count) : count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isBn ? "মাইলফলক খুঁজুন..." : "Search milestones..."}
            className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredMilestones.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center bg-muted/10">
          <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-foreground">
            {isBn ? "কোনো মাইলফলক পাওয়া যায়নি" : "No milestones found"}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {isBn
              ? "নির্বাচিত ফিল্টার বা সার্চ অনুসন্ধানের জন্য কোনো ফলাফল নেই।"
              : "No milestones match the selected filter criteria or search query."}
          </p>
          {(activeFilter !== "all" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setActiveFilter("all");
                setSearchQuery("");
              }}
              className="mt-3 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              {isBn ? "ফিল্টার রিসেট করুন" : "Reset filters"}
            </button>
          )}
        </div>
      ) : (
        /* Timeline List */
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-muted">
          {filteredMilestones.map((m, index) => {
            const isDone = m.status === "completed" || m.progress === 100;
            const isInProgress = m.status === "in_progress" && m.progress < 100;

            return (
              <div key={m.id} className="relative group">
                {/* Timeline marker icon */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-0 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 bg-card text-xs transition-colors ${
                    isDone
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                      : isInProgress
                      ? "border-primary bg-primary/10 text-primary animate-pulse"
                      : "border-muted bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    <span className="font-mono text-[11px] font-bold">
                      {isBn ? toBanglaDigits(index + 1) : index + 1}
                    </span>
                  )}
                </div>

                {/* Milestone Card */}
                <div
                  className={`rounded-xl border p-4 transition-all duration-200 ${
                    isInProgress
                      ? "border-primary/40 bg-muted/20 shadow-sm"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">
                          {m.title}
                        </h4>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            isDone
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : isInProgress
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isDone
                            ? (isBn ? "সম্পন্ন" : "Completed")
                            : isInProgress
                            ? (isBn ? "চলমান" : "In Progress")
                            : (isBn ? "আসন্ন" : "Upcoming")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {m.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap sm:flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                          {isBn ? "ওজন:" : "Weight:"} {isBn ? toBanglaDigits(m.weight) : m.weight}%
                        </span>
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary font-mono">
                          {isBn ? toBanglaDigits(m.progress) : m.progress}%
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{m.targetDate}</span>
                      </div>

                      {m.completedAt && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          {isBn ? `সম্পন্ন: ${m.completedAt}` : `Delivered: ${m.completedAt}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Milestone Mini-progress */}
                  <div className="mt-3 relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isDone ? "bg-emerald-500" : "bg-primary"
                      }`}
                      style={{ width: `${m.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
