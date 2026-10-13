"use client";

import { Headphones, Mail, MessageSquareText } from "lucide-react";
import type { HumanHandoffCardData } from "@/lib/chat/protocol";

interface HumanHandoffCardProps {
  data: HumanHandoffCardData;
  locale?: "en" | "bn";
  onTriggerFallback?: () => void;
}

export function HumanHandoffCard({
  data,
  locale = "en",
  onTriggerFallback,
}: HumanHandoffCardProps) {
  const isBn = locale === "bn";

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 shadow-sm my-2 space-y-3">
      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <Headphones className="h-4 w-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            {isBn ? "মানব সহায়তা হস্তান্তর" : "Human Team Handoff"}
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {isBn ? "সক্রিয়" : "Available"}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-foreground font-medium leading-relaxed">
          {data.reason}
        </p>
        {data.supportHours && (
          <p className="text-[11px] text-muted-foreground">
            {isBn ? `সাপোর্ট সময়: ${data.supportHours}` : `Hours: ${data.supportHours}`}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-500/10">
        <button
          type="button"
          onClick={onTriggerFallback}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          <span>{isBn ? "যোগাযোগ ফর্ম খুলুন" : "Open Contact Form"}</span>
        </button>

        {data.contactEmail && (
          <a
            href={`mailto:${data.contactEmail}`}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{isBn ? "ইমেইল পাঠান" : "Direct Email"}</span>
          </a>
        )}
      </div>
    </div>
  );
}
