"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { text } from "@/lib/admin/content-values";
import { requireAdmin } from "@/lib/auth/guards";
import type { Locale } from "@/lib/auth/routes";
import { cancelCalcomBooking } from "@/lib/calcom";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function meetingsPath(locale: Locale, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return `/${locale}/admin/meetings${query}`;
}

function actionError(locale: Locale, code: string, meetingId?: string): never {
  redirect(meetingsPath(locale, { ...(meetingId ? { meeting: meetingId } : {}), error: code }));
}

export async function cancelAdminAppointment(formData: FormData) {
  const rawLocale = text(formData, "locale");
  const locale: Locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const { supabase } = await requireAdmin(locale);
  const meetingId = text(formData, "meeting_id");
  const reason = text(formData, "reason");
  const confirmed = text(formData, "confirm") === "yes";

  if (!uuidPattern.test(meetingId) || reason.length < 3 || reason.length > 500 || !confirmed) {
    actionError(locale, "invalidInput", uuidPattern.test(meetingId) ? meetingId : undefined);
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("id,client_id,calcom_booking_uid,starts_at,status")
    .eq("id", meetingId)
    .in("status", ["confirmed", "rescheduled"])
    .maybeSingle();
  if (error) actionError(locale, "loadFailed", meetingId);
  if (!meeting) actionError(locale, "notFound");
  if (Date.parse(meeting.starts_at) <= Date.now()) actionError(locale, "alreadyStarted", meetingId);

  const apiKey = process.env.CALCOM_API_KEY?.trim();
  if (!apiKey) actionError(locale, "notConfigured", meetingId);

  try {
    await cancelCalcomBooking({
      apiKey,
      bookingUid: meeting.calcom_booking_uid,
      reason: `Cancelled by Reverse Cloud admin: ${reason}`,
    });
  } catch {
    actionError(locale, "calcomFailed", meetingId);
  }

  const removed = await createAdminClient()
    .from("meetings")
    .delete()
    .eq("id", meeting.id)
    .eq("calcom_booking_uid", meeting.calcom_booking_uid)
    .in("status", ["confirmed", "rescheduled"])
    .select("id")
    .maybeSingle();

  revalidatePath(`/${locale}/admin/meetings`);
  revalidatePath(`/${locale}/portal`);
  if (removed.error || !removed.data) {
    redirect(meetingsPath(locale, { saved: "cancelled", warning: "cleanupPending" }));
  }
  redirect(meetingsPath(locale, { saved: "cancelled" }));
}
