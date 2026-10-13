"use client";

import { CheckCircle2, Mail, ShieldCheck, User } from "lucide-react";
import type { LeadSavedCardData } from "@/lib/chat/protocol";

interface LeadSavedCardProps {
  data: LeadSavedCardData;
  locale?: "en" | "bn";
}

export function LeadSavedCard({ data, locale = "en" }: LeadSavedCardProps) {
  const isBn = locale === "bn";

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-sm my-2 space-y-3">
      <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {isBn ? "তথ্য সংরক্ষিত হয়েছে" : "Inquiry Recorded"}
          </span>
          {data.leadId && (
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              #{data.leadId}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-foreground font-medium">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{data.name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{data.email}</span>
        </div>
        {data.serviceInterest && (
          <div className="mt-1 inline-block rounded bg-background px-2 py-0.5 text-[11px] font-medium text-foreground border">
            {data.serviceInterest}
          </div>
        )}
        {data.message && (
          <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">
            &ldquo;{data.message}&rdquo;
          </p>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-background/80 p-2 text-[11px] text-muted-foreground border">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>
          {isBn
            ? "আমাদের সিনিয়র টিম ২৪ কর্মঘণ্টার মধ্যে আপনার সাথে সরাসরি যোগাযোগ করবে।"
            : "Our engineering leads review all inquiries and respond within 24 business hours."}
        </span>
      </div>
    </div>
  );
}
