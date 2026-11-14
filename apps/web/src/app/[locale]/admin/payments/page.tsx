import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ActionMessage, ContentHeader, EditorPanel, Field, FormActions, SelectField, StatusBadge, TextareaField } from "@/components/admin-content";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { paymentItemStatuses, paymentMethods, validPaymentId } from "@/lib/admin/payment-values";
import { requirePermission } from "@/lib/auth/guards";
import { savePayment, savePaymentItem, voidPayment } from "./actions";

type Search = { item?: string; payment?: string; project?: string; status?: string; saved?: string; error?: string };
type Project = { id: string; title: string; client_id: string };
type Item = { id: string; project_id: string; title: string; description: string | null; amount_due: number; currency: string; status: "pending" | "paid" | "overdue" | "cancelled"; due_on: string | null; paid_at: string | null; sort_order: number };
type Payment = { id: string; payment_item_id: string; currency: string; amount_paid: number; paid_at: string; method: string | null; reference: string | null; notes: string | null; voided_at: string | null; void_reason: string | null };

const savedKeys = new Set(["item", "payment", "voided"]);
const errorKeys = new Set(["invalidItem", "itemSaveFailed", "invalidPayment", "paymentSaveFailed", "currencyMismatch", "invalidVoid", "voidFailed"]);

function money(amount: number, currency: string, locale: string) {
  try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function dateTimeLocal(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function PaymentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase, access }, search, t, common] = await Promise.all([
    requirePermission(locale, ["payments.read", "payments.manage"]),
    searchParams,
    getTranslations({ locale, namespace: "AdminPayments" }),
    getTranslations({ locale, namespace: "AdminContent" }),
  ]);
  const canManage = access.permissions.includes("payments.manage");
  const [itemsResult, paymentsResult, projectsResult] = await Promise.all([
    supabase.from("payment_items").select("*").order("due_on", { ascending: true }).order("sort_order").limit(500),
    supabase.from("payments").select("*").order("paid_at", { ascending: false }).limit(1000),
    supabase.from("projects").select("id,title,client_id").order("title").limit(500),
  ]);
  if (itemsResult.error || paymentsResult.error) throw new Error("Unable to load payments");
  const items = (itemsResult.data ?? []) as Item[];
  const payments = (paymentsResult.data ?? []) as Payment[];
  const projects = (projectsResult.data ?? []) as Project[];
  const projectNames = new Map(projects.map((project) => [project.id, project.title]));
  const selectedItem = validPaymentId(search.item ?? "") ? items.find((item) => item.id === search.item) : undefined;
  const selectedPayment = validPaymentId(search.payment ?? "") ? payments.find((payment) => payment.id === search.payment && (!selectedItem || payment.payment_item_id === selectedItem.id)) : undefined;
  const projectFilter = validPaymentId(search.project ?? "") ? search.project : "";
  const statusFilter = paymentItemStatuses.includes(search.status as Item["status"]) ? search.status : "";
  const filtered = items.filter((item) => (!projectFilter || item.project_id === projectFilter) && (!statusFilter || item.status === statusFilter));
  const paymentsByItem = new Map<string, Payment[]>();
  for (const payment of payments) paymentsByItem.set(payment.payment_item_id, [...(paymentsByItem.get(payment.payment_item_id) ?? []), payment]);
  const received = (item: Item) => (paymentsByItem.get(item.id) ?? []).reduce((sum, payment) => sum + (payment.voided_at ? 0 : Number(payment.amount_paid)), 0);
  const currencyTotals = new Map<string, { due: number; paid: number }>();
  for (const item of filtered) {
    const totals = currencyTotals.get(item.currency) ?? { due: 0, paid: 0 };
    totals.due += Number(item.amount_due);
    totals.paid += received(item);
    currencyTotals.set(item.currency, totals);
  }
  const saved = typeof search.saved === "string" && savedKeys.has(search.saved) ? t(`saved.${search.saved}`) : null;
  const error = typeof search.error === "string" && errorKeys.has(search.error) ? t(`errors.${search.error}`) : null;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return <main className="admin-page content-page payments-page">
    <ContentHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} backLabel={common("backDashboard")} backHref="/admin" />
    <ActionMessage saved={saved} error={error} />

    <section className="payment-summary-grid">{[...currencyTotals].map(([currency, totals]) => <article key={currency}><span>{currency}</span><div><small>{t("summary.scheduled")}</small><strong>{money(totals.due, currency, locale)}</strong></div><div><small>{t("summary.received")}</small><strong>{money(totals.paid, currency, locale)}</strong></div><div><small>{t("summary.outstanding")}</small><strong>{money(Math.max(0, totals.due - totals.paid), currency, locale)}</strong></div></article>)}</section>

    <section className="content-editor payments-filters"><form method="get">
      <label className="content-field"><span>{t("fields.project")}</span><select name="project" defaultValue={projectFilter}><option value="">{t("filters.allProjects")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      <label className="content-field"><span>{t("fields.status")}</span><select name="status" defaultValue={statusFilter}><option value="">{t("filters.allStatuses")}</option>{paymentItemStatuses.map((status) => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}</select></label>
      <button className="content-primary-button" type="submit">{t("filters.apply")}</button><Link className="content-secondary-button" href="/admin/payments">{t("filters.clear")}</Link>
    </form></section>

    {canManage ? <EditorPanel title={selectedItem ? t("schedule.edit") : t("schedule.new")} defaultOpen={Boolean(selectedItem)}><form action={savePaymentItem} className="content-form">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={selectedItem?.id ?? ""} /><input type="hidden" name="existing_paid_at" value={selectedItem?.paid_at ?? ""} />
      <SelectField label={t("fields.project")} name="project_id" defaultValue={selectedItem?.project_id ?? ""}><option value="" disabled>{t("fields.selectProject")}</option>{selectedItem && !projects.some((project) => project.id === selectedItem.project_id) ? <option value={selectedItem.project_id}>{t("unknownProject")}</option> : null}{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</SelectField>
      <Field label={t("fields.title")} name="title" defaultValue={selectedItem?.title} maxLength={200} required />
      <TextareaField label={t("fields.description")} name="description" defaultValue={selectedItem?.description} rows={3} />
      <Field label={t("fields.amountDue")} name="amount_due" type="number" min="0.01" step="0.01" defaultValue={selectedItem?.amount_due} required />
      <Field label={t("fields.currency")} name="currency" defaultValue={selectedItem?.currency ?? "USD"} maxLength={3} required />
      <SelectField label={t("fields.status")} name="status" defaultValue={selectedItem?.status ?? "pending"}>{paymentItemStatuses.map((status) => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}</SelectField>
      <Field label={t("fields.dueOn")} name="due_on" type="date" defaultValue={selectedItem?.due_on} />
      <Field label={t("fields.sortOrder")} name="sort_order" type="number" step="1" defaultValue={selectedItem?.sort_order ?? 0} />
      <FormActions saveLabel={t("schedule.save")} cancelLabel={t("cancel")} cancelHref="/admin/payments" />
    </form></EditorPanel> : <p className="content-message">{t("readOnly")}</p>}

    {canManage && selectedItem && selectedItem.status !== "cancelled" && !selectedPayment?.voided_at ? <EditorPanel title={selectedPayment ? t("records.edit") : t("records.new")} defaultOpen={Boolean(selectedPayment)}><form action={savePayment} className="content-form">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={selectedPayment?.id ?? ""} /><input type="hidden" name="payment_item_id" value={selectedItem.id} /><input type="hidden" name="currency" value={selectedItem.currency} />
      <div className="payment-item-context"><strong>{selectedItem.title}</strong><span>{t("records.context", { currency: selectedItem.currency, amount: money(Number(selectedItem.amount_due), selectedItem.currency, locale) })}</span></div>
      <Field label={t("fields.amountPaid")} name="amount_paid" type="number" min="0.01" step="0.01" defaultValue={selectedPayment?.amount_paid} required />
      <Field label={t("fields.paidAt")} name="paid_at" type="datetime-local" defaultValue={dateTimeLocal(selectedPayment?.paid_at)} required />
      <SelectField label={t("fields.method")} name="method" defaultValue={selectedPayment?.method ?? "bank_transfer"}>{paymentMethods.map((method) => <option key={method} value={method}>{t(`methods.${method}`)}</option>)}</SelectField>
      <Field label={t("fields.reference")} name="reference" defaultValue={selectedPayment?.reference} maxLength={200} />
      <TextareaField label={t("fields.notes")} name="notes" defaultValue={selectedPayment?.notes} rows={3} />
      <FormActions saveLabel={t("records.save")} cancelLabel={t("cancel")} cancelHref={`/admin/payments?item=${selectedItem.id}`} />
    </form>{selectedPayment ? <form action={voidPayment} className="content-form payment-void-form"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="payment_item_id" value={selectedItem.id} /><input type="hidden" name="payment_id" value={selectedPayment.id} /><TextareaField label={t("fields.voidReason")} name="reason" required rows={2} maxLength={500} /><button className="content-secondary-button danger" type="submit">{t("records.void")}</button></form> : null}</EditorPanel> : null}

    <section className="content-list"><div className="content-list-heading"><h2>{t("schedule.title")}</h2><span>{filtered.length}</span></div><div className="content-table-wrap"><table className="content-table"><thead><tr><th>{t("fields.installment")}</th><th>{t("fields.project")}</th><th>{t("fields.due")}</th><th>{t("fields.received")}</th><th>{t("fields.status")}</th><th>{common("actions")}</th></tr></thead><tbody>{filtered.map((item) => { const paid = received(item); return <tr key={item.id}><td><strong>{item.title}</strong><small>{item.due_on || t("noDueDate")}</small></td><td>{projectNames.get(item.project_id) ?? t("unknownProject")}</td><td>{money(Number(item.amount_due), item.currency, locale)}</td><td>{money(paid, item.currency, locale)}</td><td><StatusBadge active={item.status === "paid"} activeLabel={t(`statuses.${item.status}`)} inactiveLabel={t(`statuses.${item.status}`)} warning={item.status === "overdue"} danger={item.status === "pending"} /></td><td><Link href={`/admin/payments?item=${item.id}`}>{canManage ? t("manage") : t("view")}</Link></td></tr>; })}</tbody></table></div></section>

    {selectedItem ? <section className="content-list payment-records"><div className="content-list-heading"><h2>{t("records.title")}</h2><span>{(paymentsByItem.get(selectedItem.id) ?? []).length}</span></div>{(paymentsByItem.get(selectedItem.id) ?? []).length ? <div className="content-table-wrap"><table className="content-table"><thead><tr><th>{t("fields.paidAt")}</th><th>{t("fields.amountPaid")}</th><th>{t("fields.method")}</th><th>{t("fields.reference")}</th>{canManage ? <th>{common("actions")}</th> : null}</tr></thead><tbody>{(paymentsByItem.get(selectedItem.id) ?? []).map((payment) => <tr key={payment.id}><td>{date.format(new Date(payment.paid_at))}</td><td><strong>{money(Number(payment.amount_paid), payment.currency, locale)}</strong><small>{payment.voided_at ? `${t("records.voided")}: ${payment.void_reason ?? "—"}` : payment.notes || "—"}</small></td><td>{payment.method ? t(`methods.${payment.method}`) : "—"}</td><td>{payment.reference || "—"}</td>{canManage ? <td>{payment.voided_at ? <span>{t("records.voided")}</span> : <Link href={`/admin/payments?item=${selectedItem.id}&payment=${payment.id}`}>{t("correct")}</Link>}</td> : null}</tr>)}</tbody></table></div> : <p className="payment-empty">{t("records.empty")}</p>}</section> : null}
  </main>;
}
