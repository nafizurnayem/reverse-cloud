"use client";

import Link from "next/link";
import { CheckCircle2, Clock, DollarSign, Sparkles } from "lucide-react";
import type { EstimateCardData } from "@/lib/chat/protocol";
import { formatPriceRange } from "@/lib/money";

interface EstimateCardProps {
  data: EstimateCardData;
  locale?: "en" | "bn";
  onActionClick?: (action: string) => void;
}

export function EstimateCard({ data, locale = "en", onActionClick }: EstimateCardProps) {
  const isBn = locale === "bn";
  const prices = formatPriceRange(
    data.minPriceUsd,
    data.maxPriceUsd,
    data.minPriceBdt,
    data.maxPriceBdt,
  );

  return (
    <div className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm text-card-foreground my-2 space-y-3">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {isBn ? "প্রজেক্ট এস্টিমেট" : "Project Estimate"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {isBn
              ? `${data.timelineWeeksMin}-${data.timelineWeeksMax} সপ্তাহ`
              : `${data.timelineWeeksMin}-${data.timelineWeeksMax} Weeks`}
          </span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-bold tracking-tight text-foreground">
          {data.serviceTitle}
        </h4>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {data.summary}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-2.5">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {isBn ? "ইউএসডি রেঞ্জ" : "USD Range"}
          </span>
          <p className="text-xs font-bold text-foreground flex items-center gap-0.5 mt-0.5">
            <DollarSign className="h-3 w-3 text-emerald-600" />
            <span>{prices.usd}</span>
          </p>
        </div>
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {isBn ? "বিডিটি রেঞ্জ" : "BDT Range"}
          </span>
          <p className="text-xs font-bold text-foreground mt-0.5">
            <span>{prices.bdt}</span>
          </p>
        </div>
      </div>

      {data.deliverables && data.deliverables.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-foreground">
            {isBn ? "মূল ডেলিভারেবলসমূহ:" : "Key Deliverables:"}
          </span>
          <ul className="space-y-1">
            {data.deliverables.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t">
        {data.serviceSlug && (
          <Link
            href={`/${locale}/services/${data.serviceSlug}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            {isBn ? "বিস্তারিত সার্ভিস দেখুন →" : "View Service →"}
          </Link>
        )}
        <button
          type="button"
          onClick={() => onActionClick?.("consultation")}
          className="ml-auto inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          {isBn ? "পরামর্শ বুক করুন" : "Discuss Project"}
        </button>
      </div>
    </div>
  );
}
