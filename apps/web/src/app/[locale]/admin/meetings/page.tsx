import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ActionMessage, ContentHeader, StatusBadge, TextareaField } from "@/components/admin-content";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { cancelAdminAppointment } from "./actions";

type Search = { meeting?: string; saved?: string; warning?: string; error?: string };
type Meeting = {
  id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_timezone: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "rescheduled";
  meeting_types: { name_en: string; name_bn: string | null; duration_min: number } | null;
  leads: { phone: string | null } | null;
  clients: { phone: string | null } | null;
};

const errorKeys = new Set(["invalidInput", "loadFailed", "notFound", "alreadyStarted", "notConfigured", "calcomFailed"]);

function dateTime(value: string, locale: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
  }
}

export default async function MeetingsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase, access }, search, t, common] = await Promise.all([
    requirePermission(locale, "meetings.read"),
    searchParams,
    getTranslations({ locale, namespace: "AdminMeetings" }),
    getTranslations({ locale, namespace: "AdminContent" }),
  ]);
  const { data, error } = await supabase
    .from("meetings")
    .select("id,attendee_name,attendee_email,attendee_timezone,starts_at,ends_at,status,meeting_types:meeting_type_id(name_en,name_bn,duration_min),leads:lead_id(phone),clients:client_id(phone)")
    .in("status", ["confirmed", "rescheduled"])
    .gt("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(250);
  if (error) throw new Error("Unable to load meetings");

  const meetings = (data ?? []) as unknown as Meeting[];
  const selected = meetings.find((meeting) => meeting.id === search.meeting);
  const canCancel = access.isAdmin;
  const actionError = typeof search.error === "string" && errorKeys.has(search.error) ? t(`errors.${search.error}`) : null;
  const warning = search.warning === "cleanupPending" ? t("cleanupPending") : null;
  const saved = search.saved === "cancelled" && !warning ? t("saved") : null;

  let attendeePhone = selected?.leads?.phone ?? selected?.clients?.phone ?? null;
  if (selected && !attendeePhone && selected.attendee_email) {
    const { data: leadData } = await supabase
      .from("leads")
      .select("phone")
      .eq("email", selected.attendee_email)
      .not("phone", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    attendeePhone = leadData?.phone ?? null;
  }

  return (
    <main className="admin-page content-page meetings-page">
      <ContentHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} backLabel={common("backDashboard")} backHref="/admin" />
      <ActionMessage saved={saved} error={actionError} />
      {warning ? <p className="content-message" role="status">{warning}</p> : null}

      {selected ? (
        <section className="content-editor lead-detail">
          <div className="lead-detail-heading">
            <div><p className="admin-kicker">{t("details")}</p><h2>{selected.attendee_name}</h2></div>
            <StatusBadge active activeLabel={t(`statuses.${selected.status}`)} inactiveLabel={t(`statuses.${selected.status}`)} />
          </div>
          <dl>
            <div><dt>{t("fields.email")}</dt><dd>{selected.attendee_email}</dd></div>
            <div><dt>{t("fields.phone")}</dt><dd>{attendeePhone || "—"}</dd></div>
            <div><dt>{t("fields.type")}</dt><dd>{locale === "bn" ? selected.meeting_types?.name_bn || selected.meeting_types?.name_en : selected.meeting_types?.name_en || "—"}</dd></div>
            <div><dt>{t("fields.starts")}</dt><dd>{dateTime(selected.starts_at, locale, selected.attendee_timezone)}</dd></div>
            <div><dt>{t("fields.ends")}</dt><dd>{dateTime(selected.ends_at, locale, selected.attendee_timezone)}</dd></div>
            <div><dt>{t("fields.timeZone")}</dt><dd>{selected.attendee_timezone}</dd></div>
            <div><dt>{t("fields.duration")}</dt><dd>{selected.meeting_types?.duration_min ?? "—"} {t("minutes")}</dd></div>
          </dl>
          {canCancel ? (
            <form action={cancelAdminAppointment} className="content-form meeting-cancel-form">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="meeting_id" value={selected.id} />
              <TextareaField label={t("cancel.reason")} name="reason" required rows={3} maxLength={500} placeholder={t("cancel.reasonPlaceholder")} />
              <label className="content-checkbox">
                <input name="confirm" type="checkbox" value="yes" required />
                <span><strong>{t("cancel.confirm")}</strong><small>{t("cancel.emailNotice")}</small></span>
              </label>
              <div className="content-form-actions">
                <button className="content-secondary-button danger" type="submit">{t("cancel.button")}</button>
                <Link className="content-secondary-button" href="/admin/meetings">{t("cancel.keep")}</Link>
              </div>
            </form>
          ) : <p className="content-message">{t("readOnly")}</p>}
        </section>
      ) : null}

      <section className="content-list">
        <div className="content-list-heading"><h2>{t("upcoming")}</h2><span>{meetings.length}</span></div>
        {meetings.length ? (
          <div className="content-table-wrap"><table className="content-table">
            <thead><tr><th>{t("fields.client")}</th><th>{t("fields.type")}</th><th>{t("fields.starts")}</th><th>{t("fields.status")}</th><th>{common("actions")}</th></tr></thead>
            <tbody>{meetings.map((meeting) => <tr key={meeting.id}>
              <td><strong>{meeting.attendee_name}</strong><small>{meeting.attendee_email}{meeting.leads?.phone ? ` · ${meeting.leads.phone}` : meeting.clients?.phone ? ` · ${meeting.clients.phone}` : ""}</small></td>
              <td>{locale === "bn" ? meeting.meeting_types?.name_bn || meeting.meeting_types?.name_en : meeting.meeting_types?.name_en || "—"}</td>
              <td>{dateTime(meeting.starts_at, locale, meeting.attendee_timezone)}<small>{meeting.attendee_timezone}</small></td>
              <td><StatusBadge active activeLabel={t(`statuses.${meeting.status}`)} inactiveLabel={t(`statuses.${meeting.status}`)} /></td>
              <td><Link href={`/admin/meetings?meeting=${meeting.id}`}>{canCancel ? t("manage") : t("view")}</Link></td>
            </tr>)}</tbody>
          </table></div>
        ) : <p className="content-message">{t("empty")}</p>}
      </section>
    </main>
  );
}
