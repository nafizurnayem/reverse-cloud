import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ActionMessage, ContentHeader, StatusBadge } from "@/components/admin-content";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { updateLeadStatus } from "./actions";

type Search = { lead?: string; status?: string; source?: string; saved?: string; error?: string };
const statuses = ["new", "contacted", "qualified", "converted", "lost"] as const;
const sources = ["contact_form", "chat", "estimator", "handoff", "manual"] as const;

export default async function LeadsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase, access }, search, t, common] = await Promise.all([
    requirePermission(locale, ["leads.read", "leads.manage"]),
    searchParams,
    getTranslations({ locale, namespace: "AdminLeads" }),
    getTranslations({ locale, namespace: "AdminContent" }),
  ]);
  const selectedStatus = statuses.includes(search.status as typeof statuses[number]) ? search.status : "";
  const selectedSource = sources.includes(search.source as typeof sources[number]) ? search.source : "";
  let query = supabase.from("leads")
    .select("*,services(name_en,name_bn)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (selectedStatus) query = query.eq("status", selectedStatus);
  if (selectedSource) query = query.eq("source", selectedSource);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load leads");
  const leads = data ?? [];
  const selected = leads.find((lead) => lead.id === search.lead);
  const canManage = access.permissions.includes("leads.manage");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="admin-page content-page">
      <ContentHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} backLabel={common("backDashboard")} backHref="/admin" />
      <ActionMessage saved={search.saved ? t("saved") : null} error={search.error ? t(`errors.${search.error}`) : null} />

      <section className="content-editor leads-filters">
        <form method="get">
          <label className="content-field"><span>{t("fields.status")}</span><select name="status" defaultValue={selectedStatus}><option value="">{t("filters.allStatuses")}</option>{statuses.map((status) => <option value={status} key={status}>{t(`statuses.${status}`)}</option>)}</select></label>
          <label className="content-field"><span>{t("fields.source")}</span><select name="source" defaultValue={selectedSource}><option value="">{t("filters.allSources")}</option>{sources.map((source) => <option value={source} key={source}>{t(`sources.${source}`)}</option>)}</select></label>
          <button className="content-primary-button" type="submit">{t("filters.apply")}</button>
          <Link className="content-secondary-button" href="/admin/leads">{t("filters.clear")}</Link>
        </form>
      </section>

      {selected ? <section className="content-editor lead-detail">
        <div className="lead-detail-heading"><div><p className="admin-kicker">{t("detail")}</p><h2>{selected.name}</h2></div><StatusBadge active={selected.status !== "new"} activeLabel={t(`statuses.${selected.status}`)} inactiveLabel={t("statuses.new")} warning={selected.status === "lost"}/></div>
        <dl>
          <div><dt>{t("fields.email")}</dt><dd>{selected.email || "—"}</dd></div>
          <div><dt>{t("fields.phone")}</dt><dd>{selected.phone || "—"}</dd></div>
          <div><dt>{t("fields.company")}</dt><dd>{selected.company || "—"}</dd></div>
          <div><dt>{t("fields.country")}</dt><dd>{selected.country || "—"}</dd></div>
          <div><dt>{t("fields.service")}</dt><dd>{locale === "bn" ? selected.services?.name_bn || selected.services?.name_en : selected.services?.name_en || "—"}</dd></div>
          <div><dt>{t("fields.received")}</dt><dd>{date.format(new Date(selected.created_at))}</dd></div>
        </dl>
        <div className="lead-message"><strong>{t("fields.message")}</strong><p>{selected.message || "—"}</p></div>
        {canManage ? <form action={updateLeadStatus} className="lead-status-form"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={selected.id}/><label className="content-field"><span>{t("fields.status")}</span><select name="status" defaultValue={selected.status}>{statuses.map((status) => <option value={status} key={status}>{t(`statuses.${status}`)}</option>)}</select></label><button className="content-primary-button" type="submit">{t("updateStatus")}</button></form> : null}
      </section> : null}

      <section className="content-list"><div className="content-list-heading"><h2>{t("allLeads")}</h2><span>{leads.length}</span></div><div className="content-table-wrap"><table className="content-table"><thead><tr><th>{t("fields.lead")}</th><th>{t("fields.source")}</th><th>{t("fields.service")}</th><th>{t("fields.status")}</th><th>{t("fields.received")}</th><th>{common("actions")}</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td><strong>{lead.name}</strong><small>{lead.email || lead.phone}</small></td><td>{t(`sources.${lead.source}`)}</td><td>{locale === "bn" ? lead.services?.name_bn || lead.services?.name_en : lead.services?.name_en || "—"}</td><td><StatusBadge active={lead.status !== "new"} activeLabel={t(`statuses.${lead.status}`)} inactiveLabel={t("statuses.new")} warning={lead.status === "lost"}/></td><td>{date.format(new Date(lead.created_at))}</td><td><div className="content-row-actions"><Link href={`/admin/leads?lead=${lead.id}`}>{t("open")}</Link></div></td></tr>)}</tbody></table></div></section>
    </main>
  );
}
