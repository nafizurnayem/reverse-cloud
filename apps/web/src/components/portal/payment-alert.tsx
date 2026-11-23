"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Clock,
  Download,
  X,
} from "lucide-react";
import type { PortalPaymentAlert } from "@/lib/portal/types";
import { formatBdt, formatUsd, toBanglaDigits } from "@/lib/money";
import { cn } from "@/lib/utils";

interface PaymentAlertProps {
  alert: PortalPaymentAlert;
  locale: string;
  className?: string;
  compact?: boolean;
}

export function PaymentAlert({
  alert,
  locale,
  className,
  compact = false,
}: PaymentAlertProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!alert.hasAlert || dismissed) return null;

  const isBn = locale === "bn";
  const isOverdue = alert.severity === "overdue";

  const totalUsd = isOverdue ? alert.totalOverdueUsd : alert.totalDueUsd;
  const totalBdt = isOverdue ? alert.totalOverdueBdt : alert.totalDueBdt;
  const count = isOverdue ? alert.overdueCount : alert.dueSoonCount;
  const countStr = isBn ? toBanglaDigits(count) : String(count);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "relative rounded-2xl border p-4 sm:p-5 shadow-sm transition-all",
        isOverdue
          ? "border-rose-500/40 bg-rose-500/10 text-rose-950 dark:border-rose-500/30 dark:bg-rose-950/25 dark:text-rose-100"
          : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-100",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Icon & Message */}
        <div className="flex items-start gap-3.5 min-w-0">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              isOverdue
                ? "bg-rose-500/20 text-rose-600 dark:bg-rose-500/30 dark:text-rose-400"
                : "bg-amber-500/20 text-amber-600 dark:bg-amber-500/30 dark:text-amber-400",
            )}
          >
            {isOverdue ? (
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                <AlertTriangle className="relative h-4 w-4" />
              </span>
            ) : (
              <Clock className="h-4 w-4" />
            )}
          </span>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                  isOverdue
                    ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                    : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30",
                )}
              >
                {isOverdue
                  ? isBn
                    ? "বকেয়া পেমেন্ট সতর্কতা"
                    : "Payment Overdue"
                  : isBn
                  ? "আসন্ন পেমেন্ট রিমাইন্ডার"
                  : "Payment Due Soon"}
              </span>

              <span className="font-mono text-xs font-bold">
                {formatUsd(totalUsd)} / {formatBdt(totalBdt)}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-medium leading-relaxed">
              {isOverdue
                ? isBn
                  ? `আপনার ${countStr}টি ইনভয়েস বকেয়া রয়েছে। প্রজেক্ট মাইলফলকের গতি স্বাভাবিক রাখতে অনুগ্রহ করে দ্রুত পরিশোধ করুন।`
                  : `You have ${count} overdue payment(s) totaling ${formatUsd(totalUsd)} (${formatBdt(totalBdt)}). Please settle the outstanding balance to ensure continuous milestone delivery.`
                : isBn
                ? `আপনার ${countStr}টি মাইলফলক পেমেন্ট আসন্ন। প্রথম প্রদেয় তারিখ: ${alert.earliestDueDate ?? "শীঘ্রই"}।`
                : `You have ${count} milestone payment(s) due soon totaling ${formatUsd(totalUsd)} (${formatBdt(totalBdt)}). Earliest due date: ${alert.earliestDueDate ?? "soon"}.`}
            </p>
          </div>
        </div>

        {/* Right: Dismiss button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 transition-colors shrink-0"
          aria-label={isBn ? "বিজ্ঞপ্তি বন্ধ করুন" : "Dismiss alert"}
          title={isBn ? "বিজ্ঞপ্তি বন্ধ করুন" : "Dismiss alert"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Action Buttons Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Link
            href="/portal/payments"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs",
              isOverdue
                ? "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500"
                : "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500",
            )}
          >
            <span>{isBn ? "পেমেন্ট ও ইনভয়েস দেখুন" : "View Payments & Invoices"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          {alert.items.length > 0 && !compact && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-xl border border-black/15 bg-white/40 dark:border-white/15 dark:bg-black/20 px-3 py-2 text-xs font-semibold hover:bg-white/60 dark:hover:bg-black/40 transition-colors"
            >
              <span>{expanded ? (isBn ? "সংক্ষেপ করুন" : "Hide Details") : (isBn ? "বিস্তারিত দেখুন" : "View Breakdown")}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-180")} />
            </button>
          )}
        </div>

        <span className="text-[11px] text-muted-foreground font-medium">
          {isBn
            ? `${countStr}টি অপেক্ষমান পেমেন্ট`
            : `${count} pending payment item${count === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* Expanded Breakdown List */}
      {expanded && alert.items.length > 0 && (
        <div className="mt-4 space-y-2 pt-3 border-t border-black/10 dark:border-white/10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {isBn ? "অপেক্ষমান ইনভয়েস তালিকা" : "Outstanding Invoices & Milestones"}
          </p>
          <div className="divide-y divide-black/10 dark:divide-white/10 rounded-xl border border-black/10 dark:border-white/10 bg-background/80 overflow-hidden">
            {alert.items.map((item) => {
              const itemOverdue = item.isOverdue;
              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 gap-2 hover:bg-muted/30 transition-colors text-foreground"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs truncate">
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider",
                          itemOverdue
                            ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {itemOverdue
                          ? isBn
                            ? `${toBanglaDigits(Math.abs(item.daysDiff))} দিন বকেয়া`
                            : `${Math.abs(item.daysDiff)}d overdue`
                          : isBn
                          ? `${toBanglaDigits(item.daysDiff)} দিন বাকি`
                          : `Due in ${item.daysDiff}d`}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.projectTitle} • {isBn ? "তারিখ:" : "Due:"} {item.dueDate}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="font-mono text-xs font-bold text-foreground block">
                        {formatUsd(item.amountUsd)}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground block">
                        {formatBdt(item.amountBdt)}
                      </span>
                    </div>

                    <a
                      href={item.invoiceDownloadUrl || `/api/invoices/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
                      title={isBn ? "ইনভয়েস ডাউনলোড করুন" : "Download invoice"}
                    >
                      <Download className="h-3 w-3 text-primary" />
                      <span className="font-mono">{item.invoiceNumber}</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
