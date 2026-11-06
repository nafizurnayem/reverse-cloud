import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }),
  revalidatePath: vi.fn(),
  meeting: vi.fn(),
  removedMeeting: vi.fn(),
  adminFrom: vi.fn(),
  cancelCalcomBooking: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/calcom", () => ({ cancelCalcomBooking: mocks.cancelCalcomBooking }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const query = { delete: vi.fn(), eq: vi.fn(), in: vi.fn(), select: vi.fn(), maybeSingle: mocks.removedMeeting };
    query.delete.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.select.mockReturnValue(query);
    return { from: (table: string) => { mocks.adminFrom(table); return query; } };
  },
}));

import { cancelAdminAppointment } from "../src/app/[locale]/admin/meetings/actions";

const meetingId = "00000000-0000-4000-8000-000000000701";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CALCOM_API_KEY", "cal_test_key");
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), maybeSingle: mocks.meeting };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  mocks.requireAdmin.mockResolvedValue({ supabase: { from: vi.fn(() => query) } });
  mocks.meeting.mockResolvedValue({ data: {
    id: meetingId,
    client_id: "client-1",
    calcom_booking_uid: "booking-admin-1",
    starts_at: "2099-01-10T10:00:00.000Z",
    status: "confirmed",
  }, error: null });
  mocks.removedMeeting.mockResolvedValue({ data: { id: meetingId }, error: null });
  mocks.cancelCalcomBooking.mockResolvedValue(undefined);
});

describe("admin meeting cancellation", () => {
  it("requires an administrator, cancels Cal.com, and removes the local meeting", async () => {
    const data = form({ locale: "en", meeting_id: meetingId, reason: "Client requested cancellation", confirm: "yes" });

    await expect(cancelAdminAppointment(data)).rejects.toThrow("redirect:/en/admin/meetings?saved=cancelled");
    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(mocks.cancelCalcomBooking).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "cal_test_key",
      bookingUid: "booking-admin-1",
      reason: "Cancelled by Reverse Cloud admin: Client requested cancellation",
    }));
    expect(mocks.adminFrom).toHaveBeenCalledWith("meetings");
    expect(mocks.removedMeeting).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/portal");
  });

  it("does not remove local data when Cal.com rejects cancellation", async () => {
    mocks.cancelCalcomBooking.mockRejectedValue(new Error("Cal.com unavailable"));
    const data = form({ locale: "bn", meeting_id: meetingId, reason: "Client asked to cancel", confirm: "yes" });

    await expect(cancelAdminAppointment(data)).rejects.toThrow(
      `redirect:/bn/admin/meetings?meeting=${meetingId}&error=calcomFailed`,
    );
    expect(mocks.adminFrom).not.toHaveBeenCalled();
  });

  it("rejects an unconfirmed destructive action before loading the meeting", async () => {
    const data = form({ locale: "en", meeting_id: meetingId, reason: "Client asked to cancel" });

    await expect(cancelAdminAppointment(data)).rejects.toThrow(
      `redirect:/en/admin/meetings?meeting=${meetingId}&error=invalidInput`,
    );
    expect(mocks.meeting).not.toHaveBeenCalled();
    expect(mocks.cancelCalcomBooking).not.toHaveBeenCalled();
  });
});
