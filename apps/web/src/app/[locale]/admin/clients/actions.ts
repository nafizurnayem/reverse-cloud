"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { clientPayload, validClientEmail, validClientId } from "@/lib/admin/client-values";
import { requirePermission } from "@/lib/auth/guards";
import type { Locale } from "@/lib/auth/routes";
import { validInviteToken } from "@/lib/invites/routes";
import { requireSiteUrl } from "@/lib/supabase/env";

export type InviteActionState = {
  status: "idle" | "success" | "error";
  error?: "invalidInput" | "inviteFailed" | "alreadyLinked";
  inviteUrl?: string;
  expiresAt?: string;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function localeFrom(formData: FormData): Locale {
  const value = text(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function clientsPath(locale: Locale, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return `/${locale}/admin/clients${query}`;
}

function saveError(locale: Locale, code: string, id?: string): never {
  redirect(clientsPath(locale, { ...(id ? { edit: id } : {}), error: code }));
}

export async function saveClient(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase } = await requirePermission(locale, "clients.manage");
  const id = text(formData, "id");
  const payload = clientPayload(formData);
  if ((id && !validClientId(id)) || !payload) saveError(locale, "invalidInput", id);

  const result = id
    ? await supabase.from("clients").update(payload).eq("id", id).select("id").single()
    : await supabase.from("clients").insert(payload).select("id").single();
  if (result.error || !result.data?.id) {
    saveError(locale, result.error?.code === "23505" ? "duplicateEmail" : "saveFailed", id);
  }

  const clientId = result.data.id as string;
  const path = clientsPath(locale);
  revalidatePath(path);
  redirect(clientsPath(locale, { edit: clientId, saved: "client" }));
}

export async function setClientArchived(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase } = await requirePermission(locale, "clients.manage");
  const id = text(formData, "id");
  const archived = text(formData, "archived") === "true";
  if (!validClientId(id)) saveError(locale, "invalidInput");

  const result = await supabase.from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (result.error) saveError(locale, "saveFailed", id);

  revalidatePath(clientsPath(locale));
  redirect(clientsPath(locale, { edit: id, saved: archived ? "archived" : "restored" }));
}

export async function createClientInvite(
  _previous: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const locale = localeFrom(formData);
  const { supabase } = await requirePermission(locale, "clients.manage");
  const clientId = text(formData, "client_id");
  const email = text(formData, "email").toLowerCase();
  if (!validClientId(clientId) || !validClientEmail(email)) {
    return { status: "error", error: "invalidInput" };
  }

  const result = await supabase.rpc("create_client_invite", {
    p_client_id: clientId,
    p_email: email,
    p_send_email: false,
  });
  if (result.error) {
    return {
      status: "error",
      error: result.error.message?.includes("client_already_linked")
        ? "alreadyLinked"
        : "inviteFailed",
    };
  }

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  const token = validInviteToken(row?.token);
  if (!token || typeof row?.expires_at !== "string") {
    return { status: "error", error: "inviteFailed" };
  }

  let inviteUrl: string;
  try {
    const url = new URL(`/${locale}/accept-invite`, requireSiteUrl());
    url.searchParams.set("token", token);
    inviteUrl = url.toString();
  } catch {
    return { status: "error", error: "inviteFailed" };
  }

  revalidatePath(clientsPath(locale));
  return { status: "success", inviteUrl, expiresAt: row.expires_at };
}

export async function revokeClientInvite(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase } = await requirePermission(locale, "clients.manage");
  const clientId = text(formData, "client_id");
  const inviteId = text(formData, "invite_id");
  if (!validClientId(clientId) || !validClientId(inviteId)) {
    saveError(locale, "invalidInput", validClientId(clientId) ? clientId : undefined);
  }

  const result = await supabase.rpc("revoke_client_invite", { p_invite_id: inviteId });
  if (result.error || result.data !== true) saveError(locale, "inviteFailed", clientId);

  revalidatePath(clientsPath(locale));
  redirect(clientsPath(locale, { edit: clientId, saved: "inviteRevoked" }));
}
