"use client";

import { ExternalLink, Globe, MonitorCheck, Rocket } from "lucide-react";

interface LivePreviewCardProps {
  previewUrl?: string;
  projectTitle?: string;
  locale: string;
}

export function LivePreviewCard({
  previewUrl,
  locale,
}: LivePreviewCardProps) {
  const isBn = locale === "bn";

  if (!previewUrl) {
    return (
      <div className="rounded-2xl border bg-card p-6 shadow-sm text-card-foreground">
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Globe className="h-7 w-7" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {isBn ? "লাইভ প্রিভিউ — শীঘ্রই আসছে" : "Live Preview — Coming Soon"}
            </h4>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
              {isBn
                ? "মাইলস্টোন ১ সম্পন্ন হওয়ার পর স্টেজিং প্রিভিউ লিঙ্ক উপলব্ধ হবে।"
                : "Available after Milestone 1 — staging deployment URL will appear here."}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            <Rocket className="h-3 w-3" />
            {isBn ? "মাইলস্টোন ১-এর পরে" : "Available after Milestone 1"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-sm text-card-foreground space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MonitorCheck className="h-6 w-6" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">
              {isBn ? "লাইভ স্টেজিং প্রিভিউ" : "Live Staging Preview"}
            </h4>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isBn ? "সক্রিয়" : "Online"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">
            {previewUrl}
          </p>
        </div>
      </div>

      {/* Prominent launch button */}
      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
      >
        <span>{isBn ? "প্রিভিউ খুলুন" : "Launch Preview"}</span>
        <ExternalLink className="h-4 w-4" />
      </a>

      <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
        <span>
          {isBn
            ? "নোট: এই প্রিভিউ পরিবেশটি শুধুমাত্র ক্লায়েন্ট যাচাইকরণ এবং টেস্ট করার জন্য নিবেদিত।"
            : "Note: This isolated sandbox environment reflects real-time continuous deployment from the development branch."}
        </span>
      </div>
    </div>
  );
}
