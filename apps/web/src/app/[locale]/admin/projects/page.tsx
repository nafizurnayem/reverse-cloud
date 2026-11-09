import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ActionMessage,
  CheckboxField,
  ContentHeader,
  EditorPanel,
  Field,
  FormActions,
  SelectField,
  StatusBadge,
  TextareaField,
} from "@/components/admin-content";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { projectMemberRoles, projectStatuses, validProjectId } from "@/lib/admin/project-values";
import { requirePermission } from "@/lib/auth/guards";
import {
  addProjectUpdate,
  deleteProjectUpdate,
  removeProjectMember,
  saveProject,
  saveProjectMember,
} from "./actions";
import { MilestoneEditor } from "./milestone-editor";

type Search = { edit?: string; status?: string; saved?: string; error?: string };
type Project = {
  id: string; client_id: string; title: string; description: string | null;
  status: "active" | "on_hold" | "completed" | "cancelled";
  preview_url: string | null; progress_pct: number | null; client_progress_pct: number | null;
  starts_on: string | null; due_on: string | null; updated_at: string;
};
type Client = { id: string; full_name: string; company: string | null; archived_at: string | null };
type Milestone = {
  id: string; title: string; description: string | null; weight: number; is_done: boolean;
  is_client_visible: boolean; preview_url: string | null; due_on: string | null; sort_order: number;
};
type Member = { user_id: string; role: string; joined_at: string };
type Staff = { user_id: string; full_name: string | null; role_names: string[] | null };
type Update = { id: string; author_id: string | null; body: string; is_client_visible: boolean; created_at: string };

const savedKeys = new Set(["project", "milestones", "member", "memberRemoved", "update", "updateRemoved"]);
const errorKeys = new Set(["invalidInput", "saveFailed", "activationNeedsMilestones", "invalidMilestones", "milestoneSaveFailed", "memberSaveFailed", "invalidUpdate", "updateSaveFailed"]);

export default async function ProjectsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [{ supabase, access }, search, t, common] = await Promise.all([
    requirePermission(locale, ["projects.create", "projects.update"]),
    searchParams,
    getTranslations({ locale, namespace: "AdminProjects" }),
    getTranslations({ locale, namespace: "AdminContent" }),
  ]);
  const canCreate = access.permissions.includes("projects.create");
  const canUpdate = access.permissions.includes("projects.update");
  const [projectsResult, clientsResult] = await Promise.all([
    supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(200),
    canCreate || canUpdate
      ? supabase.from("clients").select("id,full_name,company,archived_at").is("archived_at", null).order("full_name").limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (projectsResult.error) throw new Error("Unable to load projects");

  const projects = (projectsResult.data ?? []) as Project[];
  const clients = (clientsResult.data ?? []) as Client[];
  const editId = validProjectId(search.edit ?? "") ? search.edit! : null;
  let selected = editId ? projects.find((project) => project.id === editId) : undefined;
  if (editId && !selected) {
    // Project not in the cached list (e.g. > 200 projects or stale cache); fetch directly.
    const directResult = await supabase.from("projects").select("*").eq("id", editId).maybeSingle();
    if (directResult.data) selected = directResult.data as Project;
  }
  const selectedStatus = projectStatuses.includes(search.status as Project["status"]) ? search.status : "";
  const filteredProjects = selectedStatus ? projects.filter((project) => project.status === selectedStatus) : projects;
  const clientNames = new Map(clients.map((client) => [client.id, client.company || client.full_name]));

  let milestones: Milestone[] = [];
  let members: Member[] = [];
  let staff: Staff[] = [];
  let updates: Update[] = [];
  let selectedClientName = "";
  if (selected) {
    const [milestonesResult, membersResult, updatesResult, staffResult] = await Promise.all([
      supabase.from("milestones").select("*").eq("project_id", selected.id).order("sort_order"),
      supabase.from("project_members").select("user_id,role,joined_at").eq("project_id", selected.id),
      supabase.from("project_updates").select("id,author_id,body,is_client_visible,created_at").eq("project_id", selected.id).order("created_at", { ascending: false }).limit(100),
      canCreate ? supabase.rpc("list_project_staff") : Promise.resolve({ data: [], error: null }),
    ]);
    if (milestonesResult.error || membersResult.error || updatesResult.error || staffResult.error) throw new Error("Unable to load project details");
    milestones = (milestonesResult.data ?? []) as Milestone[];
    members = (membersResult.data ?? []) as Member[];
    updates = (updatesResult.data ?? []) as Update[];
    staff = (staffResult.data ?? []) as Staff[];

    const matchedClient = clients.find((client) => client.id === selected.client_id);
    if (matchedClient) {
      selectedClientName = matchedClient.company ? `${matchedClient.company} — ${matchedClient.full_name}` : matchedClient.full_name;
    } else {
      const singleClient = await supabase.from("clients").select("id,full_name,company").eq("id", selected.client_id).maybeSingle();
      if (singleClient.data) {
        selectedClientName = singleClient.data.company ? `${singleClient.data.company} — ${singleClient.data.full_name}` : singleClient.data.full_name;
      } else {
        selectedClientName = clientNames.get(selected.client_id) ?? t("unknownClient");
      }
    }
  }

  const saved = typeof search.saved === "string" && savedKeys.has(search.saved) ? t(`saved.${search.saved}`) : null;
  const error = typeof search.error === "string" && errorKeys.has(search.error) ? t(`errors.${search.error}`) : null;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const staffNames = new Map(staff.map((person) => [person.user_id, person.full_name || t("team.unnamed")]));

  return (
    <main className="admin-page content-page projects-page">
      <ContentHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} backLabel={common("backDashboard")} backHref="/admin" />
      <ActionMessage saved={saved} error={error} />

      <section className="content-editor projects-filters">
        <form method="get">
          {editId ? <input type="hidden" name="edit" value={editId} /> : null}
          <label className="content-field"><span>{t("fields.status")}</span><select name="status" defaultValue={selectedStatus}>
            <option value="">{t("filters.allStatuses")}</option>
            {projectStatuses.map((status) => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}
          </select></label>
          <button className="content-primary-button" type="submit">{t("filters.apply")}</button>
          <Link className="content-secondary-button" href="/admin/projects">{t("filters.clear")}</Link>
        </form>
      </section>

      {canCreate || selected ? (
        <EditorPanel key={selected?.id ?? "new"} title={selected ? `${t("editProject")}: ${selected.title}` : t("newProject")}>
          <form key={selected?.id ?? "new"} action={saveProject} className="content-form">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={selected?.id ?? ""} />
            {selected ? (
              <>
                <input type="hidden" name="client_id" value={selected.client_id} />
                <Field label={t("fields.client")} name="client_name" defaultValue={selectedClientName} readOnly />
              </>
            ) : (
              <SelectField label={t("fields.client")} name="client_id" defaultValue="">
                <option value="" disabled>{t("fields.selectClient")}</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.company ? `${client.company} — ${client.full_name}` : client.full_name}</option>)}
              </SelectField>
            )}
            <Field label={t("fields.projectTitle")} name="title" defaultValue={selected?.title} maxLength={200} required />
            <TextareaField label={t("fields.description")} name="description" defaultValue={selected?.description} rows={4} />
            <SelectField key={`status-${selected?.id ?? "new"}-${selected?.status ?? "on_hold"}`} label={t("fields.status")} name="status" defaultValue={selected?.status ?? "on_hold"}>
              {projectStatuses.map((status) => <option key={status} value={status} disabled={!selected && status !== "on_hold"}>{t(`statuses.${status}`)}</option>)}
            </SelectField>
            <Field label={t("fields.previewUrl")} name="preview_url" type="url" defaultValue={selected?.preview_url} maxLength={500} placeholder="https://" />
            <Field label={t("fields.startsOn")} name="starts_on" type="date" defaultValue={selected?.starts_on} />
            <Field label={t("fields.dueOn")} name="due_on" type="date" defaultValue={selected?.due_on} />
            <FormActions saveLabel={t("save")} cancelLabel={t("cancel")} cancelHref="/admin/projects" />
          </form>
        </EditorPanel>
      ) : null}

      {selected ? <>
        <section className="project-summary-grid">
          <article><span>{t("summary.staffProgress")}</span><strong>{selected.progress_pct == null ? "—" : `${selected.progress_pct}%`}</strong></article>
          <article><span>{t("summary.clientProgress")}</span><strong>{selected.client_progress_pct == null ? "—" : `${selected.client_progress_pct}%`}</strong></article>
          <article><span>{t("summary.milestones")}</span><strong>{milestones.filter((item) => item.is_done).length}/{milestones.length}</strong></article>
          <article><span>{t("summary.preview")}</span>{selected.preview_url ? <a href={selected.preview_url} target="_blank" rel="noreferrer">{t("openPreview")}</a> : <strong>—</strong>}</article>
        </section>

        {canUpdate ? <section className="content-editor project-section">
          <div className="project-section-heading"><div><p className="admin-kicker">{t("milestones.eyebrow")}</p><h2>{t("milestones.title")}</h2></div><p>{t("milestones.description")}</p></div>
          <MilestoneEditor locale={locale} projectId={selected.id} initial={milestones.map((item) => ({ id: item.id, title: item.title, description: item.description ?? "", weight: Number(item.weight), is_done: item.is_done, is_client_visible: item.is_client_visible, preview_url: item.preview_url ?? "", due_on: item.due_on ?? "" }))} labels={{ title: t("fields.milestoneTitle"), description: t("fields.description"), weight: t("fields.weight"), dueOn: t("fields.dueOn"), previewUrl: t("fields.previewUrl"), done: t("fields.done"), visible: t("fields.clientVisible"), add: t("milestones.add"), remove: t("milestones.remove"), save: t("milestones.save"), total: t("milestones.total"), totalHint: t("milestones.totalHint") }} />
        </section> : null}

        {canCreate ? <section className="content-editor project-section">
          <div className="project-section-heading"><div><p className="admin-kicker">{t("team.eyebrow")}</p><h2>{t("team.title")}</h2></div><p>{t("team.description")}</p></div>
          <form action={saveProjectMember} className="project-inline-form">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="project_id" value={selected.id} />
            <SelectField label={t("fields.staffMember")} name="user_id"><option value="" disabled>{t("team.selectStaff")}</option>{staff.map((person) => <option key={person.user_id} value={person.user_id}>{person.full_name || t("team.unnamed")} · {(person.role_names ?? []).join(", ")}</option>)}</SelectField>
            <SelectField label={t("fields.projectRole")} name="role" defaultValue="developer">{projectMemberRoles.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}</SelectField>
            <button className="content-primary-button" type="submit">{t("team.assign")}</button>
          </form>
          <div className="project-member-list">{members.length ? members.map((member) => <div key={member.user_id}><span><strong>{staffNames.get(member.user_id) ?? t("team.unnamed")}</strong><small>{t(`roles.${member.role}`)}</small></span><form action={removeProjectMember}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="project_id" value={selected.id} /><input type="hidden" name="user_id" value={member.user_id} /><button className="content-secondary-button danger" type="submit">{t("team.remove")}</button></form></div>) : <p>{t("team.empty")}</p>}</div>
        </section> : null}

        {canUpdate ? <section className="content-editor project-section">
          <div className="project-section-heading"><div><p className="admin-kicker">{t("updates.eyebrow")}</p><h2>{t("updates.title")}</h2></div><p>{t("updates.description")}</p></div>
          <form action={addProjectUpdate} className="content-form project-update-form"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="project_id" value={selected.id} /><TextareaField label={t("fields.updateBody")} name="body" required rows={4} /><CheckboxField label={t("fields.clientVisible")} name="is_client_visible" defaultChecked hint={t("updates.visibilityHint")} /><button className="content-primary-button" type="submit">{t("updates.publish")}</button></form>
          <div className="project-update-list">{updates.length ? updates.map((update) => <article key={update.id}><div><span>{date.format(new Date(update.created_at))}</span><StatusBadge active={update.is_client_visible} activeLabel={t("updates.visible")} inactiveLabel={t("updates.internal")} /></div><p>{update.body}</p><form action={deleteProjectUpdate}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="project_id" value={selected.id} /><input type="hidden" name="update_id" value={update.id} /><button className="content-secondary-button danger" type="submit">{t("updates.delete")}</button></form></article>) : <p>{t("updates.empty")}</p>}</div>
        </section> : null}
      </> : null}

      <section className="content-list">
        <div className="content-list-heading"><h2>{t("allProjects")}</h2><span>{filteredProjects.length}</span></div>
        <div className="content-table-wrap">
          <table className="content-table">
            <thead>
              <tr>
                <th>{t("fields.projectTitle")}</th>
                <th>{t("fields.client")}</th>
                <th>{t("fields.status")}</th>
                <th>{t("fields.progress")}</th>
                <th>{t("fields.dueOn")}</th>
                <th>{common("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const isSelected = project.id === selected?.id;
                return (
                  <tr
                    key={project.id}
                    className={isSelected ? "bg-muted/40 font-medium" : undefined}
                  >
                    <td>
                      <strong>{project.title}</strong>
                      <small>{project.description || "—"}</small>
                    </td>
                    <td>{clientNames.get(project.client_id) ?? t("unknownClient")}</td>
                    <td>
                      <StatusBadge
                        active={project.status === "active" || project.status === "completed"}
                        activeLabel={t(`statuses.${project.status}`)}
                        inactiveLabel={t(`statuses.${project.status}`)}
                        warning={project.status === "on_hold"}
                      />
                    </td>
                    <td>{project.progress_pct == null ? "—" : `${project.progress_pct}%`}</td>
                    <td>{project.due_on || "—"}</td>
                    <td>
                      {isSelected ? (
                        <span className="font-semibold text-primary">
                          {locale === "bn" ? "✓ সম্পাদনা চলছে" : "✓ Active"}
                        </span>
                      ) : (
                        <Link href={`/admin/projects?edit=${project.id}`}>{t("edit")}</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
