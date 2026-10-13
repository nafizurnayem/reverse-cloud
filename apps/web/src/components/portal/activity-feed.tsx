"use client";

import {
  Activity,
  CheckCircle2,
  CreditCard,
  GitCommit,
  Radio,
  Rocket,
} from "lucide-react";
import type { PortalActivityItem } from "@/lib/portal/types";

interface ActivityFeedProps {
  activity: PortalActivityItem[];
  locale: string;
}

export function ActivityFeed({ activity, locale }: ActivityFeedProps) {
  const isBn = locale === "bn";

  function getIcon(type: PortalActivityItem["type"]) {
    switch (type) {
      case "preview_deployed":
        return <Rocket className="h-3.5 w-3.5 text-primary" />;
      case "milestone_completed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
      case "payment_received":
        return <CreditCard className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />;
      case "code_committed":
        return <GitCommit className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
      default:
        return <Radio className="h-3.5 w-3.5 text-primary" />;
    }
  }

  function formatTime(iso: string): string {
    try {
      const date = new Date(iso);
      return date.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm text-card-foreground space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span>{isBn ? "সাম্প্রতিক কার্যকলাপ ও আপডেট" : "Recent Activity & Feed"}</span>
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {activity.length} {isBn ? "আপডেট" : "Events"}
        </span>
      </div>

      <div className="space-y-4">
        {activity.map((item) => (
          <div key={item.id} className="flex items-start gap-3 text-xs">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-muted/40 mt-0.5">
              {getIcon(item.type)}
            </span>

            <div className="flex-1 space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
                <span className="font-semibold text-foreground text-xs">
                  {item.title}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatTime(item.timestamp)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {item.description}
              </p>
              <span className="inline-block text-[10px] text-primary/80 font-medium">
                — {item.author}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
