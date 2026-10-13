"use client";

import { ExternalLink, Globe, MonitorCheck } from "lucide-react";

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
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Globe className="h-5 w-5" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {isBn ? "লাইভ প্রিভিউ পরিবেশ" : "Live Preview Environment"}
            </h4>
            <p className="text-xs text-muted-foreground">
              {isBn
                ? "স্টেজিং প্রিভিউ লিঙ্ক শীঘ্রই প্রদান করা হবে।"
                : "Staging deployment URL will be available upon Milestone 1 completion."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-sm text-card-foreground space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MonitorCheck className="h-5 w-5" />
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

        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors shrink-0"
        >
          <span>{isBn ? "প্রিভিউ দেখুন" : "Launch Preview"}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

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
