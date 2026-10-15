"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { paymentItemPayload, paymentPayload, validPaymentId } from "@/lib/admin/payment-values";
import { requirePermission } from "@/lib/auth/guards";
import type { Locale } from "@/lib/auth/routes";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function localeFrom(formData: FormData): Locale {
  const value = text(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}
function paymentsPath(locale: Locale, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return `/${locale}/admin/payments${query}`;
}
function actionError(locale: Locale, code: string, itemId?: string): never {
  redirect(paymentsPath(locale, { ...(itemId ? { item: itemId } : {}), error: code }));
}
function revalidate(locale: Locale) {
  revalidatePath(paymentsPath(locale));
  revalidatePath(`/${locale}/portal/payments`);
  revalidatePath(`/${locale}/portal`);
}

export async function savePaymentItem(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, user } = await requirePermission(locale, "payments.manage");
  const id = text(formData, "id");
  const payload = paymentItemPayload(formData);
  if ((id && !validPaymentId(id)) || !payload) actionError(locale, "invalidItem", id);
  let result;
  if (id) {
    const existingPaidAt = text(formData, "existing_paid_at");
    const updates = { title: payload.title, description: payload.description, amount_due: payload.amount_due, currency: payload.currency, status: payload.status, due_on: payload.due_on, sort_order: payload.sort_order, paid_at: payload.status === "paid" ? (existingPaidAt || new Date().toISOString()) : null };
    result = await supabase.from("payment_items").update(updates).eq("id", id).select("id").single();
  } else {
    result = await supabase.from("payment_items").insert({ ...payload, created_by: user.id }).select("id").single();
  }
  if (result.error || !result.data?.id) actionError(locale, "itemSaveFailed", id);
  const itemId = result.data.id as string;
  revalidate(locale);
  redirect(paymentsPath(locale, { item: itemId, saved: "item" }));
}

export async function savePayment(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, user } = await requirePermission(locale, "payments.manage");
  const id = text(formData, "id");
  const payload = paymentPayload(formData);
  if ((id && !validPaymentId(id)) || !payload) actionError(locale, "invalidPayment", payload?.payment_item_id);
  let result;
  if (id) {
    const updates = { amount_paid: payload.amount_paid, paid_at: payload.paid_at, method: payload.method, reference: payload.reference, notes: payload.notes };
    result = await supabase.from("payments").update(updates).eq("id", id);
  } else {
    result = await supabase.from("payments").insert({ ...payload, recorded_by: user.id });
  }
  if (result.error) actionError(locale, result.error.code === "23503" ? "currencyMismatch" : "paymentSaveFailed", payload.payment_item_id);
  revalidate(locale);
  redirect(paymentsPath(locale, { item: payload.payment_item_id, saved: "payment" }));
}

export async function voidPayment(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase } = await requirePermission(locale, "payments.manage");
  const itemId = text(formData, "payment_item_id");
  const paymentId = text(formData, "payment_id");
  const reason = text(formData, "reason");
  if (!validPaymentId(itemId) || !validPaymentId(paymentId) || !reason || reason.length > 500) {
    actionError(locale, "invalidVoid", validPaymentId(itemId) ? itemId : undefined);
  }

  const result = await supabase.rpc("void_payment", {
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (result.error || result.data !== paymentId) actionError(locale, "voidFailed", itemId);

  revalidate(locale);
  redirect(paymentsPath(locale, { item: itemId, saved: "voided" }));
}
