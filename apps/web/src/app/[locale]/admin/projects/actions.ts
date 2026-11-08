"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import {
  milestonePlanPayload,
  projectPayload,
  validProjectId,
  validProjectMemberRole,
} from "@/lib/admin/project-values";
import { requirePermission } from "@/lib/auth/guards";
import type { Locale } from "@/lib/auth/routes";
import { staffDashboardPath, type StaffAccess } from "@/lib/auth/permissions";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function localeFrom(formData: FormData): Locale {
  const value = text(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function projectsPath(access: StaffAccess, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return `${staffDashboardPath(access, "/projects")}${query}`;
}

function actionError(access: StaffAccess, code: string, id?: string): never {
  redirect(projectsPath(access, { ...(id ? { edit: id } : {}), error: code }));
}

function revalidate(locale: Locale) {
  revalidatePath(`/${locale}/admin/projects`);
  revalidatePath(`/${locale}/portal`);
}

export async function saveProject(formData: FormData) {
  const locale = localeFrom(formData);
  const id = text(formData, "id");
  const { supabase, user, access } = await requirePermission(locale, id ? ["projects.create", "projects.update"] : "projects.create");
  const payload = projectPayload(formData);
  if ((id && !validProjectId(id)) || !payload) actionError(access, "invalidInput", id);

  if (payload.status === "active") {
    if (!id) actionError(access, "activationNeedsMilestones");
    const milestones = await supabase.from("milestones").select("weight").eq("project_id", id);
    const total = (milestones.data ?? []).reduce((sum, row) => sum + Number(row.weight), 0);
    if (milestones.error || Math.abs(total - 100) > 0.001) actionError(access, "activationNeedsMilestones", id);
  }

  let result;
  if (id) {
    const updates = {
      title: payload.title,
      description: payload.description,
      status: payload.status,
      preview_url: payload.preview_url,
      starts_on: payload.starts_on,
      due_on: payload.due_on,
      completed_at: payload.completed_at,
    };
    result = await supabase.from("projects").update(updates).eq("id", id).select("id").single();
  } else {
    result = await supabase.from("projects")
      .insert({ ...payload, status: "on_hold", completed_at: null, created_by: user.id })
      .select("id")
      .single();
  }
  if (result.error || !result.data?.id) actionError(access, "saveFailed", id);

  const projectId = result.data.id as string;
  revalidate(locale);
  redirect(projectsPath(access, { edit: projectId, saved: "project" }));
}

export async function replaceProjectMilestones(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "projects.update");
  const projectId = text(formData, "project_id");
  const milestones = milestonePlanPayload(text(formData, "milestones"));
  if (!validProjectId(projectId) || !milestones) actionError(access, "invalidMilestones", projectId);

  const result = await supabase.rpc("replace_project_milestones", { p_project_id: projectId, p_milestones: milestones });
  if (result.error) actionError(access, "milestoneSaveFailed", projectId);
  revalidate(locale);
  redirect(projectsPath(access, { edit: projectId, saved: "milestones" }));
}

export async function saveProjectMember(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "projects.create");
  const projectId = text(formData, "project_id");
  const userId = text(formData, "user_id");
  const role = text(formData, "role");
  if (!validProjectId(projectId) || !validProjectId(userId) || !validProjectMemberRole(role)) actionError(access, "invalidInput", projectId);

  const result = await supabase.from("project_members").upsert(
    { project_id: projectId, user_id: userId, role },
    { onConflict: "project_id,user_id" },
  );
  if (result.error) actionError(access, "memberSaveFailed", projectId);
  revalidate(locale);
  redirect(projectsPath(access, { edit: projectId, saved: "member" }));
}

export async function removeProjectMember(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "projects.create");
  const projectId = text(formData, "project_id");
  const userId = text(formData, "user_id");
  if (!validProjectId(projectId) || !validProjectId(userId)) actionError(access, "invalidInput", projectId);

  const result = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  if (result.error) actionError(access, "memberSaveFailed", projectId);
  revalidate(locale);
  redirect(projectsPath(access, { edit: projectId, saved: "memberRemoved" }));
}

export async function addProjectUpdate(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, user, access } = await requirePermission(locale, "projects.update");
  const projectId = text(formData, "project_id");
  const body = text(formData, "body");
  if (!validProjectId(projectId) || !body || body.length > 10000) actionError(access, "invalidUpdate", projectId);

  const result = await supabase.from("project_updates").insert({
    project_id: projectId,
    author_id: user.id,
    body,
    is_client_visible: formData.get("is_client_visible") === "on",
  });
  if (result.error) actionError(access, "updateSaveFailed", projectId);
  revalidate(locale);
  redirect(projectsPath(access, { edit: projectId, saved: "update" }));
}

export async function deleteProjectUpdate(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "projects.update");
  const projectId = text(formData, "project_id");
  const updateId = text(formData, "update_id");
  if (!validProjectId(projectId) || !validProjectId(updateId)) actionError(access, "invalidInput", projectId);

  const result = await supabase.from("project_updates").delete().eq("project_id", projectId).eq("id", updateId);
  if (result.error) actionError(access, "updateSaveFailed", projectId);
  revalidate(locale);
  redirect(projectsPath(access, { edit: projectId, saved: "updateRemoved" }));
}
