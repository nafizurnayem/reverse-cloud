import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createClientInvite,
  revokeClientInvite,
  saveClient,
  setClientArchived,
} from "../src/app/[locale]/admin/clients/actions";
import { clientPayload } from "../src/lib/admin/client-values";

const clientId = "00000000-0000-4000-8000-000000000010";
const inviteId = "00000000-0000-4000-8000-000000000020";

function clientForm(overrides: Record<string, string> = {}) {
  const values = {
    locale: "en",
    id: "",
    full_name: "  Example Client  ",
    email: "  Person@Example.COM ",
    phone: "+8801000000000",
    company: "Example Ltd",
    country: "Bangladesh",
    timezone: "Asia/Dhaka",
    preferred_locale: "bn",
    stage: "prospect",
    source: "fiverr",
    source_ref: "order-123",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

function queryBuilder(singleResult = { data: { id: clientId }, error: null }) {
  const builder = {
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(singleResult),
  };
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reverse-cloud.example/some/path");
  mocks.requirePermission.mockResolvedValue({
    supabase: { from: mocks.from, rpc: mocks.rpc },
  });
});

describe("client values", () => {
  it("normalizes valid client input without allowing user_id writes", () => {
    expect(clientPayload(clientForm())).toEqual({
      full_name: "Example Client",
      email: "person@example.com",
      phone: "+8801000000000",
      company: "Example Ltd",
      country: "Bangladesh",
      timezone: "Asia/Dhaka",
      preferred_locale: "bn",
      stage: "prospect",
      source: "fiverr",
      source_ref: "order-123",
    });
  });

  it("rejects invalid database enums, emails and field lengths", () => {
    expect(clientPayload(clientForm({ source: "social_media" }))).toBeNull();
    expect(clientPayload(clientForm({ email: "not-an-email" }))).toBeNull();
    expect(clientPayload(clientForm({ full_name: "x".repeat(201) }))).toBeNull();
  });
});

describe("Clients admin actions", () => {
  it("creates a client using only permitted fields", async () => {
    const builder = queryBuilder();
    mocks.from.mockReturnValue(builder);

    await expect(saveClient(clientForm())).rejects.toThrow(
      `redirect:/en/admin/clients?edit=${clientId}&saved=client`,
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith("en", "clients.manage");
    expect(mocks.from).toHaveBeenCalledWith("clients");
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      full_name: "Example Client",
      email: "person@example.com",
      source: "fiverr",
    }));
    expect(builder.insert.mock.calls[0][0]).not.toHaveProperty("user_id");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/clients");
  });

  it("archives and restores clients instead of deleting them", async () => {
    let builder = queryBuilder();
    mocks.from.mockReturnValue(builder);
    const archive = clientForm({ id: clientId, archived: "true" });
    await expect(setClientArchived(archive)).rejects.toThrow(
      `redirect:/en/admin/clients?edit=${clientId}&saved=archived`,
    );
    expect(builder.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });

    builder = queryBuilder();
    mocks.from.mockReturnValue(builder);
    const restore = clientForm({ id: clientId, archived: "false" });
    await expect(setClientArchived(restore)).rejects.toThrow(
      `redirect:/en/admin/clients?edit=${clientId}&saved=restored`,
    );
    expect(builder.update).toHaveBeenCalledWith({ archived_at: null });
  });

  it("creates a localized one-time invite URL with email delivery disabled", async () => {
    const token = "a".repeat(43);
    mocks.rpc.mockResolvedValue({
      data: [{ invite_id: inviteId, token, expires_at: "2026-10-28T00:00:00.000Z" }],
      error: null,
    });
    const formData = new FormData();
    formData.set("locale", "bn");
    formData.set("client_id", clientId);
    formData.set("email", " Person@Example.COM ");

    const state = await createClientInvite({ status: "idle" }, formData);

    expect(mocks.rpc).toHaveBeenCalledWith("create_client_invite", {
      p_client_id: clientId,
      p_email: "person@example.com",
      p_send_email: false,
    });
    expect(state).toEqual({
      status: "success",
      inviteUrl: `https://reverse-cloud.example/bn/accept-invite?token=${token}`,
      expiresAt: "2026-10-28T00:00:00.000Z",
    });
  });

  it("does not call the invite RPC for malformed client input", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("client_id", "bad-id");
    formData.set("email", "bad-email");

    await expect(createClientInvite({ status: "idle" }, formData)).resolves.toEqual({
      status: "error",
      error: "invalidInput",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("revokes an open invitation through the privileged RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("client_id", clientId);
    formData.set("invite_id", inviteId);

    await expect(revokeClientInvite(formData)).rejects.toThrow(
      `redirect:/en/admin/clients?edit=${clientId}&saved=inviteRevoked`,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_client_invite", {
      p_invite_id: inviteId,
    });
  });
});
