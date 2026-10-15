import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/guards";
import {
  PaymentsView,
  type CurrencyTotal,
  type PaymentReceipt,
  type PaymentScheduleItem,
} from "@/components/portal";

type Project = { id: string; title: string };
type Item = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  amount_due: number;
  currency: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  due_on: string | null;
  paid_at: string | null;
};
type Payment = {
  id: string;
  payment_item_id: string;
  amount_paid: number;
  currency: string;
  paid_at: string;
  method: string | null;
  reference: string | null;
};

export default async function PortalPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [{ supabase }, t] = await Promise.all([
    requireUser(locale, `/${locale}/portal/payments`),
    getTranslations({ locale, namespace: "PortalPayments" }),
  ]);

  const [projectsResult, itemsResult, paymentsResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id,title")
      .order("updated_at", { ascending: false }),
    supabase
      .from("payment_items")
      .select(
        "id,project_id,title,description,amount_due,currency,status,due_on,paid_at",
      )
      .order("due_on", { ascending: true }),
    supabase
      .from("payments")
      .select(
        "id,payment_item_id,amount_paid,currency,paid_at,method,reference",
      )
      .order("paid_at", { ascending: false }),
  ]);

  if (projectsResult.error || itemsResult.error || paymentsResult.error) {
    throw new Error("Unable to load payment schedule");
  }

  const projects = (projectsResult.data ?? []) as Project[];
  const items = (itemsResult.data ?? []) as Item[];
  const payments = (paymentsResult.data ?? []) as Payment[];

  const projectNames = new Map(projects.map((p) => [p.id, p.title]));
  const receiptsByItem: Record<string, PaymentReceipt[]> = {};

  for (const p of payments) {
    if (!receiptsByItem[p.payment_item_id]) {
      receiptsByItem[p.payment_item_id] = [];
    }
    receiptsByItem[p.payment_item_id].push(p);
  }

  const totalsMap = new Map<string, { scheduled: number; received: number }>();
  for (const item of items.filter((row) => row.status !== "cancelled")) {
    const total = totalsMap.get(item.currency) ?? { scheduled: 0, received: 0 };
    total.scheduled += Number(item.amount_due);
    total.received += (receiptsByItem[item.id] ?? []).reduce(
      (sum, p) => sum + Number(p.amount_paid),
      0,
    );
    totalsMap.set(item.currency, total);
  }

  const totals: CurrencyTotal[] = [...totalsMap].map(([currency, total]) => ({
    currency,
    scheduled: total.scheduled,
    received: total.received,
    outstanding: Math.max(0, total.scheduled - total.received),
  }));

  const scheduleItems: PaymentScheduleItem[] = items.map((item) => ({
    id: item.id,
    project_id: item.project_id,
    project_title: projectNames.get(item.project_id) ?? t("project"),
    title: item.title,
    description: item.description,
    amount_due: Number(item.amount_due),
    currency: item.currency,
    status: item.status,
    due_on: item.due_on,
    paid_at: item.paid_at,
  }));

  const labels = {
    back: t("back"),
    title: t("title"),
    description: t("description"),
    scheduled: t("scheduled"),
    received: t("received"),
    outstanding: t("outstanding"),
    project: t("project"),
    amountDue: t("amountDue"),
    amountReceived: t("amountReceived"),
    dueDate: t("dueDate"),
    notSet: t("notSet"),
    receipts: t("receipts"),
    invoice: t("invoice"),
    downloadInvoice: t("downloadInvoice"),
    emptyTitle: t("emptyTitle"),
    emptyDescription: t("emptyDescription"),
    statuses: {
      pending: t("statuses.pending"),
      paid: t("statuses.paid"),
      overdue: t("statuses.overdue"),
      cancelled: t("statuses.cancelled"),
    },
  };

  return (
    <PaymentsView
      locale={locale}
      items={scheduleItems}
      totals={totals}
      receiptsByItem={receiptsByItem}
      labels={labels}
    />
  );
}
