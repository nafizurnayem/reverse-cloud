"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileText,
} from "lucide-react";
import type { PortalPaymentItem, PortalProject } from "@/lib/portal/types";
import { InvoiceModal } from "./invoice-modal";

export interface PaymentScheduleItem {
  id: string;
  project_id: string;
  project_title: string;
  title: string;
  description: string | null;
  amount_due: number;
  currency: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  due_on: string | null;
  paid_at: string | null;
}

export interface PaymentReceipt {
  id: string;
  payment_item_id: string;
  amount_paid: number;
  currency: string;
  paid_at: string;
  method: string | null;
  reference: string | null;
}

export interface CurrencyTotal {
  currency: string;
  scheduled: number;
  received: number;
  outstanding: number;
}

interface PaymentsViewProps {
  locale: string;
  items: PaymentScheduleItem[];
  totals: CurrencyTotal[];
  receiptsByItem: Record<string, PaymentReceipt[]>;
  labels: {
    back: string;
    title: string;
    description: string;
    scheduled: string;
    received: string;
    outstanding: string;
    project: string;
    amountDue: string;
    amountReceived: string;
    dueDate: string;
    notSet: string;
    receipts: string;
    invoice: string;
    downloadInvoice: string;
    emptyTitle: string;
    emptyDescription: string;
    statuses: Record<string, string>;
  };
}

function formatMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function PaymentsView({
  locale,
  items,
  totals,
  receiptsByItem,
  labels,
}: PaymentsViewProps) {
  const isBn = locale === "bn";
  const [selectedInvoice, setSelectedInvoice] = useState<{
    payment: PortalPaymentItem;
    project: PortalProject;
  } | null>(null);

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  function handleOpenInvoice(item: PaymentScheduleItem) {
    const isBdt = item.currency === "BDT";
    const amountNum = Number(item.amount_due);
    const amountUsd = isBdt ? Math.round(amountNum / 120) : amountNum;
    const amountBdt = isBdt ? amountNum : Math.round(amountNum * 120);

    const paymentItem: PortalPaymentItem = {
      id: item.id,
      title: item.title,
      amountUsd,
      amountBdt,
      status: item.status === "paid" ? "paid" : item.status === "pending" ? "due" : "upcoming",
      dueDate: item.due_on ?? "",
      paidAt: item.paid_at ?? undefined,
      invoiceNumber: `INV-${item.id.slice(0, 8).toUpperCase()}`,
      invoiceDownloadUrl: `/api/invoices/${item.id}`,
    };

    const mockProject: PortalProject = {
      id: item.project_id,
      title: item.project_title,
      clientName: "Client",
      companyName: "Client Organization",
      description: "",
      status: "active",
      currentStage: item.title,
      startDate: "",
      targetCompletionDate: item.due_on ?? "",
      budgetUsd: amountUsd,
      budgetBdt: amountBdt,
      milestones: [],
      activity: [],
      payments: [paymentItem],
    };

    setSelectedInvoice({ payment: paymentItem, project: mockProject });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b pb-6 space-y-3">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{labels.back}</span>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {labels.title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {labels.description}
          </p>
        </div>
      </div>

      {/* Totals Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {totals.map((t) => (
          <div
            key={t.currency}
            className="rounded-2xl border bg-card p-5 shadow-sm text-card-foreground space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.currency} {isBn ? "মুদ্রা" : "Summary"}
              </span>
              <CreditCard className="h-4 w-4 text-primary" />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{labels.scheduled}</span>
                <strong className="font-mono text-sm text-foreground">
                  {formatMoney(t.scheduled, t.currency, locale)}
                </strong>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{labels.received}</span>
                <strong className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                  {formatMoney(t.received, t.currency, locale)}
                </strong>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="font-semibold text-foreground">{labels.outstanding}</span>
                <strong className="font-mono text-sm font-bold text-foreground">
                  {formatMoney(t.outstanding, t.currency, locale)}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Items List */}
      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => {
            const receipts = receiptsByItem[item.id] ?? [];
            const received = receipts.reduce(
              (sum, payment) => sum + Number(payment.amount_paid),
              0,
            );
            const isPaid = item.status === "paid";

            return (
              <article
                key={item.id}
                className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm text-card-foreground space-y-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      {item.project_title}
                    </span>
                    <h2 className="mt-1 text-base font-bold text-foreground">
                      {item.title}
                    </h2>
                    {item.description && (
                      <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start shrink-0">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                        isPaid
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : item.status === "overdue"
                          ? "bg-red-500/10 text-red-700 dark:text-red-400"
                          : item.status === "cancelled"
                          ? "bg-muted text-muted-foreground"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {labels.statuses[item.status] ?? item.status}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenInvoice(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted hover:text-primary transition-colors shadow-sm"
                    >
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span>{labels.invoice}</span>
                    </button>

                    <a
                      href={`/api/invoices/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border bg-background p-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted transition-colors shadow-sm"
                      title={labels.downloadInvoice}
                      aria-label={labels.downloadInvoice}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      {labels.amountDue}
                    </span>
                    <strong className="mt-1 block font-mono text-sm text-foreground">
                      {formatMoney(Number(item.amount_due), item.currency, locale)}
                    </strong>
                  </div>

                  <div className="rounded-xl bg-muted/40 p-3">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      {labels.amountReceived}
                    </span>
                    <strong
                      className={`mt-1 block font-mono text-sm ${
                        received > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatMoney(received, item.currency, locale)}
                    </strong>
                  </div>

                  <div className="rounded-xl bg-muted/40 p-3">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      {labels.dueDate}
                    </span>
                    <strong className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.due_on
                        ? dateFormatter.format(new Date(`${item.due_on}T00:00:00`))
                        : labels.notSet}
                    </strong>
                  </div>
                </div>

                {receipts.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{labels.receipts}</span>
                    </h3>
                    <div className="space-y-2">
                      {receipts.map((rec) => (
                        <div
                          key={rec.id}
                          className="flex flex-col gap-1 rounded-xl border bg-background/50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            {dateFormatter.format(new Date(rec.paid_at))}
                            {rec.reference ? ` · Ref: ${rec.reference}` : ""}
                            {rec.method ? ` (${rec.method})` : ""}
                          </span>
                          <strong className="font-mono text-foreground font-semibold">
                            {formatMoney(Number(rec.amount_paid), rec.currency, locale)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
          <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h2 className="text-base font-bold text-foreground">
            {labels.emptyTitle}
          </h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {labels.emptyDescription}
          </p>
        </div>
      )}

      {selectedInvoice && (
        <InvoiceModal
          payment={selectedInvoice.payment}
          project={selectedInvoice.project}
          locale={locale}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
