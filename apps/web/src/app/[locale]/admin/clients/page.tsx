import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ActionMessage,
  ContentHeader,
  EditorPanel,
  Field,
  FormActions,
  SelectField,
  StatusBadge,
} from "@/components/admin-content";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { clientSources, clientStages, validClientId } from "@/lib/admin/client-values";
import { requirePermission } from "@/lib/auth/guards";
import { revokeClientInvite, saveClient, setClientArchived } from "./actions";
import { InviteForm } from "./invite-form";

type Search = {
  edit?: string;
  stage?: string;
  source?: string;
  archived?: string;
  saved?: string;
  error?: string;
};

type Client = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  country: string | null;
  timezone: string | null;
  preferred_locale: "en" | "bn";
  stage: (typeof clientStages)[number];
  source: (typeof clientSources)[number];
  source_ref: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type Invite = {
  id: string;
  client_id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type InviteStatus = "open" | "accepted" | "revoked" | "expired";

const savedKeys = new Set(["client", "archived", "restored", "inviteRevoked"]);
const errorKeys = new Set(["invalidInput", "duplicateEmail", "saveFailed", "inviteFailed"]);

function invitationStatus(invite: Invite, now: number): InviteStatus {
  if (invite.accepted_at) return "accepted";
  if (invite.revoked_at) return "revoked";
  if (new Date(invite.expires_at).getTime() <= now) return "expired";
  return "open";
}

export default async function ClientsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [{ supabase }, search, t, common] = await Promise.all([
    requirePermission(locale, "clients.manage"),
    searchParams,
    getTranslations({ locale, namespace: "AdminClients" }),
    getTranslations({ locale, namespace: "AdminContent" }),
  ]);
  const [clientsResult, invitesResult] = await Promise.all([
    supabase.from("clients").select("*").order("updated_at", { ascending: false }).limit(200),
    supabase.from("client_invites")
      .select("id,client_id,email,expires_at,accepted_at,revoked_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (clientsResult.error || invitesResult.error) throw new Error("Unable to load clients");

  const clients = (clientsResult.data ?? []) as Client[];
  const invites = (invitesResult.data ?? []) as Invite[];
  const selected = validClientId(search.edit ?? "")
    ? clients.find((client) => client.id === search.edit)
    : undefined;
  const selectedStage = clientStages.includes(search.stage as Client["stage"]) ? search.stage : "";
  const selectedSource = clientSources.includes(search.source as Client["source"]) ? search.source : "";
  const archivedFilter = ["active", "archived", "all"].includes(search.archived ?? "")
    ? search.archived
    : "active";
  const filteredClients = clients.filter((client) => {
    if (selectedStage && client.stage !== selectedStage) return false;
    if (selectedSource && client.source !== selectedSource) return false;
    if (archivedFilter === "active" && client.archived_at) return false;
    if (archivedFilter === "archived" && !client.archived_at) return false;
    return true;
  });
  const latestInvite = new Map<string, Invite>();
  for (const invite of invites) {
    if (!latestInvite.has(invite.client_id)) latestInvite.set(invite.client_id, invite);
  }
  const selectedInvite = selected ? latestInvite.get(selected.id) : undefined;
  // This server component reads the clock once per request to label expired invites.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const saved = typeof search.saved === "string" && savedKeys.has(search.saved)
    ? t(`saved.${search.saved}`)
    : null;
  const error = typeof search.error === "string" && errorKeys.has(search.error)
    ? t(`errors.${search.error}`)
    : null;

  return (
    <main className="admin-page content-page">
      <ContentHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        backLabel={common("backDashboard")}
        backHref="/admin"
      />
      <ActionMessage saved={saved} error={error} />

      <section className="content-editor clients-filters">
        <form method="get">
          <label className="content-field">
            <span>{t("fields.stage")}</span>
            <select name="stage" defaultValue={selectedStage}>
              <option value="">{t("filters.allStages")}</option>
              {clientStages.map((stage) => <option key={stage} value={stage}>{t(`stages.${stage}`)}</option>)}
            </select>
          </label>
          <label className="content-field">
            <span>{t("fields.source")}</span>
            <select name="source" defaultValue={selectedSource}>
              <option value="">{t("filters.allSources")}</option>
              {clientSources.map((source) => <option key={source} value={source}>{t(`sources.${source}`)}</option>)}
            </select>
          </label>
          <label className="content-field">
            <span>{t("fields.recordStatus")}</span>
            <select name="archived" defaultValue={archivedFilter}>
              <option value="active">{t("filters.activeRecords")}</option>
              <option value="archived">{t("filters.archivedRecords")}</option>
              <option value="all">{t("filters.allRecords")}</option>
            </select>
          </label>
          <button className="content-primary-button" type="submit">{t("filters.apply")}</button>
          <Link className="content-secondary-button" href="/admin/clients">{t("filters.clear")}</Link>
        </form>
      </section>

      <EditorPanel title={selected ? t("editClient") : t("newClient")}>
        <form action={saveClient} className="content-form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={selected?.id ?? ""} />
          <Field label={t("fields.fullName")} name="full_name" defaultValue={selected?.full_name} maxLength={200} required />
          <Field label={t("fields.email")} name="email" type="email" defaultValue={selected?.email} maxLength={254} />
          <Field label={t("fields.phone")} name="phone" type="tel" defaultValue={selected?.phone} maxLength={40} />
          <Field label={t("fields.company")} name="company" defaultValue={selected?.company} maxLength={200} />
          <Field label={t("fields.country")} name="country" defaultValue={selected?.country} maxLength={100} />
          <Field label={t("fields.timezone")} name="timezone" defaultValue={selected?.timezone} maxLength={64} placeholder="Asia/Dhaka" />
          <SelectField label={t("fields.locale")} name="preferred_locale" defaultValue={selected?.preferred_locale ?? locale}>
            <option value="en">{t("locales.en")}</option>
            <option value="bn">{t("locales.bn")}</option>
          </SelectField>
          <SelectField label={t("fields.stage")} name="stage" defaultValue={selected?.stage ?? "prospect"}>
            {clientStages.map((stage) => <option key={stage} value={stage}>{t(`stages.${stage}`)}</option>)}
          </SelectField>
          <SelectField label={t("fields.source")} name="source" defaultValue={selected?.source ?? "website"}>
            {clientSources.map((source) => <option key={source} value={source}>{t(`sources.${source}`)}</option>)}
          </SelectField>
          <Field label={t("fields.sourceRef")} name="source_ref" defaultValue={selected?.source_ref} maxLength={200} />
          <FormActions saveLabel={t("save")} cancelLabel={t("cancel")} cancelHref="/admin/clients" />
        </form>
      </EditorPanel>

      {selected ? (
        <section className="content-editor client-invite-panel">
          <div className="client-panel-heading">
            <div>
              <p className="admin-kicker">{t("invite.eyebrow")}</p>
              <h2>{t("invite.title")}</h2>
            </div>
            <StatusBadge
              active={Boolean(selected.user_id)}
              activeLabel={t("account.linked")}
              inactiveLabel={t("account.unlinked")}
            />
          </div>
          <p>{t("invite.description")}</p>

          {selectedInvite ? (() => {
            const status = invitationStatus(selectedInvite, now);
            return (
              <div className="client-invite-history">
                <div>
                  <strong>{t("invite.latest")}</strong>
                  <span>{selectedInvite.email}</span>
                  <small>{t("invite.expires", { date: date.format(new Date(selectedInvite.expires_at)) })}</small>
                </div>
                <StatusBadge
                  active={status === "accepted" || status === "open"}
                  activeLabel={t(`invite.statuses.${status}`)}
                  inactiveLabel={t(`invite.statuses.${status}`)}
                  warning={status === "open"}
                />
                {status === "open" ? (
                  <form action={revokeClientInvite}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="client_id" value={selected.id} />
                    <input type="hidden" name="invite_id" value={selectedInvite.id} />
                    <button className="content-secondary-button danger" type="submit">{t("invite.revoke")}</button>
                  </form>
                ) : null}
              </div>
            );
          })() : <p className="client-invite-empty">{t("invite.none")}</p>}

          {selected.archived_at ? <p className="content-message content-message-error">{t("invite.archived")}</p>
            : selected.user_id ? <p className="content-message content-message-success">{t("invite.alreadyLinked")}</p>
              : selected.email ? (
                <InviteForm
                  key={selected.id}
                  locale={locale}
                  clientId={selected.id}
                  email={selected.email}
                  labels={{
                    create: t("invite.create"),
                    creating: t("invite.creating"),
                    copy: t("invite.copy"),
                    copied: t("invite.copied"),
                    copyFailed: t("invite.copyFailed"),
                    oneTimeHint: t("invite.oneTimeHint"),
                    expires: t.raw("invite.expires") as string,
                    errors: {
                      invalidInput: t("errors.invalidInput"),
                      inviteFailed: t("errors.inviteFailed"),
                      alreadyLinked: t("errors.alreadyLinked"),
                    },
                  }}
                />
              ) : <p className="content-message content-message-error">{t("invite.needsEmail")}</p>}
        </section>
      ) : null}

      <section className="content-list">
        <div className="content-list-heading"><h2>{t("allClients")}</h2><span>{filteredClients.length}</span></div>
        <div className="content-table-wrap">
          <table className="content-table">
            <thead><tr><th>{t("fields.client")}</th><th>{t("fields.source")}</th><th>{t("fields.stage")}</th><th>{t("fields.account")}</th><th>{t("fields.invite")}</th><th>{common("actions")}</th></tr></thead>
            <tbody>{filteredClients.map((client) => {
              const invite = latestInvite.get(client.id);
              const status = invite ? invitationStatus(invite, now) : null;
              return (
                <tr key={client.id}>
                  <td><strong>{client.full_name}</strong><small>{client.company || client.email || client.phone || "—"}</small></td>
                  <td>{t(`sources.${client.source}`)}</td>
                  <td><StatusBadge active={client.stage !== "prospect"} activeLabel={t(`stages.${client.stage}`)} inactiveLabel={t("stages.prospect")} warning={client.stage === "past"} /></td>
                  <td>{client.archived_at ? t("account.archived") : client.user_id ? t("account.linked") : t("account.unlinked")}</td>
                  <td>{status ? t(`invite.statuses.${status}`) : t("invite.statuses.none")}</td>
                  <td><div className="content-row-actions">
                    <Link href={`/admin/clients?edit=${client.id}`}>{t("edit")}</Link>
                    <form action={setClientArchived}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={client.id} />
                      <input type="hidden" name="archived" value={client.archived_at ? "false" : "true"} />
                      <button className={client.archived_at ? "" : "danger"} type="submit">
                        {client.archived_at ? t("restore") : t("archive")}
                      </button>
                    </form>
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
