"use client";

import { Download, FileText, Printer, X } from "lucide-react";
import type { PortalPaymentItem, PortalProject } from "@/lib/portal/types";
import { formatBdt, formatUsd } from "@/lib/money";

interface InvoiceModalProps {
  payment: PortalPaymentItem;
  project: PortalProject;
  locale: string;
  onClose: () => void;
}

export function InvoiceModal({
  payment,
  project,
  locale,
  onClose,
}: InvoiceModalProps) {
  const isBn = locale === "bn";

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl border bg-card p-6 sm:p-8 shadow-2xl text-card-foreground">
        {/* Header Actions */}
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              {payment.invoiceNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={payment.invoiceDownloadUrl || `/api/invoices/${payment.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted hover:text-primary transition-colors shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>{isBn ? "ডাউনলোড" : "Download"}</span>
            </a>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{isBn ? "প্রিন্ট" : "Print"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Invoice Body */}
        <div className="space-y-6 text-xs">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-base font-extrabold text-foreground tracking-tight">
                Reverse Cloud Inc.
              </h2>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Advanced Cloud Engineering & AI Systems
              </p>
              <p className="text-muted-foreground text-[11px]">
                Dhaka, Bangladesh & Wilmington, DE, USA
              </p>
              <p className="text-muted-foreground text-[11px]">
                billing@revcloud.dev
              </p>
            </div>

            <div className="text-right">
              <span
                className={`inline-block rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                  payment.status === "paid"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {payment.status.toUpperCase()}
              </span>
              <p className="font-mono text-[11px] text-muted-foreground mt-1">
                {isBn ? "তারিখ:" : "Due Date:"} {payment.dueDate}
              </p>
              {payment.paidAt && (
                <p className="font-mono text-[11px] text-emerald-600">
                  {isBn ? "পরিশোধিত:" : "Paid On:"} {payment.paidAt}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              {isBn ? "বিল প্রাপক:" : "Billed To:"}
            </span>
            <h4 className="text-sm font-bold text-foreground mt-0.5">
              {project.clientName}
            </h4>
            <p className="text-xs text-muted-foreground">{project.companyName}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isBn ? "প্রজেক্ট:" : "Project:"} {project.title}
            </p>
          </div>

          {/* Line items table */}
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3">{isBn ? "বিবরণ" : "Description"}</th>
                  <th className="py-2 px-3 text-right">{isBn ? "পরিমাণ (USD)" : "Amount (USD)"}</th>
                  <th className="py-2 px-3 text-right">{isBn ? "পরিমাণ (BDT)" : "Amount (BDT)"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-3 px-3">
                    <p className="font-medium text-foreground">{payment.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isBn
                        ? `প্রজেক্ট #${project.id}-এর জন্য মাইলফলক ডেলিভারি`
                        : `Milestone delivery item for project #${project.id}`}
                    </p>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold">
                    {formatUsd(payment.amountUsd)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                    {formatBdt(payment.amountBdt)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center rounded-xl bg-muted/50 p-4 text-xs font-bold">
            <span className="text-foreground">{isBn ? "মোট প্রদেয়:" : "Total Amount:"}</span>
            <div className="text-right">
              <span className="text-base text-foreground font-mono">
                {formatUsd(payment.amountUsd)}
              </span>
              <span className="block text-[11px] text-muted-foreground font-normal font-mono">
                ≈ {formatBdt(payment.amountBdt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
