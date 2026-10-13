"use client";

import { useState } from "react";
import { CreditCard, FileText } from "lucide-react";
import type { PortalPaymentItem, PortalProject } from "@/lib/portal/types";
import { formatBdt, formatUsd } from "@/lib/money";
import { InvoiceModal } from "./invoice-modal";

interface PaymentScheduleProps {
  project: PortalProject;
  locale: string;
}

export function PaymentSchedule({ project, locale }: PaymentScheduleProps) {
  const isBn = locale === "bn";
  const [selectedInvoice, setSelectedInvoice] = useState<PortalPaymentItem | null>(null);

  return (
    <>
      <div className="rounded-2xl border bg-card p-6 shadow-sm text-card-foreground space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span>{isBn ? "পেমেন্ট শিডিউল ও ইনভয়েস" : "Payment Schedule & Invoices"}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isBn
                ? "মাইলফলক ভিত্তিক পেমেন্ট ও ইনভয়েস ডাউনলোড"
                : "Milestone-linked disbursement schedule and official invoices"}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">
              {isBn ? "মোট বাজেট" : "Total Budget"}
            </span>
            <p className="text-xs font-bold text-foreground font-mono">
              {formatUsd(project.budgetUsd)}
            </p>
          </div>
        </div>

        <div className="divide-y divide-border rounded-xl border overflow-hidden">
          {project.payments.map((pay) => {
            const isPaid = pay.status === "paid";
            const isDue = pay.status === "due";

            return (
              <div
                key={pay.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 bg-card hover:bg-muted/20 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-xs">
                      {pay.title}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isPaid
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : isDue
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isPaid
                        ? (isBn ? "পরিশোধিত" : "Paid")
                        : isDue
                        ? (isBn ? "প্রদেয়" : "Due")
                        : (isBn ? "আসন্ন" : "Upcoming")}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{isBn ? "তারিখ:" : "Due:"} {pay.dueDate}</span>
                    <span className="font-mono text-[10px] text-muted-foreground/80">
                      #{pay.invoiceNumber}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <span className="block font-mono font-bold text-xs text-foreground">
                      {formatUsd(pay.amountUsd)}
                    </span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      ≈ {formatBdt(pay.amountBdt)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(pay)}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted hover:text-primary transition-colors shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span>{isBn ? "ইনভয়েস" : "Invoice"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedInvoice && (
        <InvoiceModal
          payment={selectedInvoice}
          project={project}
          locale={locale}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </>
  );
}
