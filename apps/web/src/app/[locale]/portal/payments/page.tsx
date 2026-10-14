import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, CreditCard } from "lucide-react";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/guards";

type Project = { id: string; title: string };
type Item = { id: string; project_id: string; title: string; description: string | null; amount_due: number; currency: string; status: "pending" | "paid" | "overdue" | "cancelled"; due_on: string | null; paid_at: string | null };
type Payment = { id: string; payment_item_id: string; amount_paid: number; currency: string; paid_at: string; method: string | null; reference: string | null };

function money(amount: number, currency: string, locale: string) {
  try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

export default async function PortalPaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase }, t] = await Promise.all([requireUser(locale, `/${locale}/portal/payments`), getTranslations({ locale, namespace: "PortalPayments" })]);
  const [projectsResult, itemsResult, paymentsResult] = await Promise.all([
    supabase.from("projects").select("id,title").order("updated_at", { ascending: false }),
    supabase.from("payment_items").select("id,project_id,title,description,amount_due,currency,status,due_on,paid_at").order("due_on", { ascending: true }),
    supabase.from("payments").select("id,payment_item_id,amount_paid,currency,paid_at,method,reference").order("paid_at", { ascending: false }),
  ]);
  if (projectsResult.error || itemsResult.error || paymentsResult.error) throw new Error("Unable to load payment schedule");
  const projects = (projectsResult.data ?? []) as Project[];
  const items = (itemsResult.data ?? []) as Item[];
  const payments = (paymentsResult.data ?? []) as Payment[];
  const projectNames = new Map(projects.map((project) => [project.id, project.title]));
  const paymentsByItem = new Map<string, Payment[]>();
  for (const payment of payments) paymentsByItem.set(payment.payment_item_id, [...(paymentsByItem.get(payment.payment_item_id) ?? []), payment]);
  const totals = new Map<string, { scheduled: number; received: number }>();
  for (const item of items.filter((row) => row.status !== "cancelled")) {
    const total = totals.get(item.currency) ?? { scheduled: 0, received: 0 };
    total.scheduled += Number(item.amount_due);
    total.received += (paymentsByItem.get(item.id) ?? []).reduce((sum, payment) => sum + Number(payment.amount_paid), 0);
    totals.set(item.currency, total);
  }
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return <div className="space-y-8">
    <div className="border-b pb-6 space-y-3">
      <Link href={`/${locale}/portal`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />{t("back")}</Link>
      <div><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{t("title")}</h1><p className="mt-1.5 text-sm text-muted-foreground">{t("description")}</p></div>
    </div>

    <div className="grid gap-4 md:grid-cols-3">{[...totals].map(([currency, total]) => <div key={currency} className="rounded-2xl border bg-card p-5 shadow-sm"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{currency}</span><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span>{t("scheduled")}</span><strong>{money(total.scheduled, currency, locale)}</strong></div><div className="flex justify-between"><span>{t("received")}</span><strong className="text-emerald-600">{money(total.received, currency, locale)}</strong></div><div className="flex justify-between border-t pt-2"><span>{t("outstanding")}</span><strong>{money(Math.max(0, total.scheduled - total.received), currency, locale)}</strong></div></div></div>)}</div>

    {items.length ? <div className="space-y-4">{items.map((item) => {
      const records = paymentsByItem.get(item.id) ?? [];
      const received = records.reduce((sum, payment) => sum + Number(payment.amount_paid), 0);
      const paid = item.status === "paid";
      return <article key={item.id} className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{projectNames.get(item.project_id) ?? t("project")}</span><h2 className="mt-1 text-base font-bold">{item.title}</h2>{item.description ? <p className="mt-1 text-xs text-muted-foreground">{item.description}</p> : null}</div><span className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${paid ? "bg-emerald-500/10 text-emerald-700" : item.status === "overdue" ? "bg-red-500/10 text-red-700" : item.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-700"}`}>{t(`statuses.${item.status}`)}</span></div>
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-muted/40 p-3"><span className="text-[10px] uppercase text-muted-foreground">{t("amountDue")}</span><strong className="mt-1 block font-mono text-sm">{money(Number(item.amount_due), item.currency, locale)}</strong></div><div className="rounded-xl bg-muted/40 p-3"><span className="text-[10px] uppercase text-muted-foreground">{t("amountReceived")}</span><strong className="mt-1 block font-mono text-sm">{money(received, item.currency, locale)}</strong></div><div className="rounded-xl bg-muted/40 p-3"><span className="text-[10px] uppercase text-muted-foreground">{t("dueDate")}</span><strong className="mt-1 flex items-center gap-1.5 text-sm"><CalendarDays className="h-3.5 w-3.5" />{item.due_on ? date.format(new Date(`${item.due_on}T00:00:00`)) : t("notSet")}</strong></div></div>
        {records.length ? <div className="border-t pt-4"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{t("receipts")}</h3><div className="space-y-2">{records.map((payment) => <div key={payment.id} className="flex flex-col gap-1 rounded-lg border bg-background p-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{date.format(new Date(payment.paid_at))}{payment.reference ? ` · ${payment.reference}` : ""}</span><strong className="font-mono">{money(Number(payment.amount_paid), payment.currency, locale)}</strong></div>)}</div></div> : null}
      </article>;
    })}</div> : <div className="rounded-2xl border bg-card p-10 text-center"><CreditCard className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-bold">{t("emptyTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p></div>}
  </div>;
}
