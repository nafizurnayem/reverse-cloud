import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    storage: mocks.storage,
  }),
}));

import { GET } from "../src/app/api/invoices/[id]/route";

function makeRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/invoices/${id}`);
}

describe("Invoice Download & Storage API (Wave 4 / Task 3.6)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 Unauthorized when not logged in", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("No session"),
    });

    const response = await GET(makeRequest("inv-123"), {
      params: Promise.resolve({ id: "inv-123" }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 Forbidden when client attempts to access another client's invoice", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-client-b" } },
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "staff_roles") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [] }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "client-b-id" } }),
            }),
          }),
        };
      }
      if (table === "payment_items") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "pi-client-a",
                    project_id: "proj-client-a",
                    title: "Deposit",
                    amount_due: 5000,
                    currency: "USD",
                    status: "paid",
                    projects: {
                      id: "proj-client-a",
                      client_id: "client-a-id", // Owned by client A, NOT client B!
                      title: "Client A Project",
                      clients: { full_name: "Client A", company: "A Corp" },
                    },
                  },
                }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    });

    const response = await GET(makeRequest("pi-client-a"), {
      params: Promise.resolve({ id: "pi-client-a" }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("redirects (307) to signed URL when PDF exists in private storage bucket", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-client-a" } },
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "staff_roles") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [] }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "client-a-id" } }),
            }),
          }),
        };
      }
      if (table === "payment_items") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "pi-uuid-001",
                    project_id: "proj-uuid-100",
                    title: "50% Milestone Disbursement",
                    amount_due: 4500,
                    currency: "USD",
                    status: "paid",
                    due_on: "2026-10-31",
                    paid_at: "2026-10-25T10:00:00Z",
                    projects: {
                      id: "proj-uuid-100",
                      client_id: "client-a-id",
                      title: "Microservices Modernization",
                      clients: { full_name: "Rahim Chowdhury", company: "FinTech BD" },
                    },
                  },
                }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    });

    mocks.storage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://supabase.local/storage/v1/object/sign/invoices/proj-uuid-100/pi-uuid-001.pdf?token=sec" },
        error: null,
      }),
    });

    const response = await GET(makeRequest("pi-uuid-001"), {
      params: Promise.resolve({ id: "pi-uuid-001" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("https://supabase.local/storage/v1/object/sign/invoices");
  });

  it("renders official HTML invoice when client owns the item and no static PDF uploaded yet", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-client-a" } },
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "staff_roles") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [] }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "client-a-id" } }),
            }),
          }),
        };
      }
      if (table === "payment_items") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "pi-uuid-002",
                    project_id: "proj-uuid-100",
                    title: "Final Delivery Installment",
                    amount_due: 2500,
                    currency: "USD",
                    status: "pending",
                    due_on: "2026-11-15",
                    paid_at: null,
                    projects: {
                      id: "proj-uuid-100",
                      client_id: "client-a-id",
                      title: "Microservices Modernization",
                      clients: { full_name: "Rahim Chowdhury", company: "FinTech BD" },
                    },
                  },
                }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    });

    mocks.storage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("File not in bucket"),
      }),
    });

    const response = await GET(makeRequest("pi-uuid-002"), {
      params: Promise.resolve({ id: "pi-uuid-002" }),
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("INV-PI-UUID-");
    expect(html).toContain("Microservices Modernization");
    expect(html).toContain("Final Delivery Installment");
    expect(html).toContain("$2,500");
    expect(html).toContain("Rahim Chowdhury");
  });

  it("allows staff with payments.read to access invoices across any project", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "staff-pm-id" } },
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "staff_roles") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  {
                    role_id: "role-pm",
                    roles: { role_permissions: [{ permission_key: "payments.read" }] },
                  },
                ],
              }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
          }),
        };
      }
      if (table === "payment_items") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "pi-any-003",
                    project_id: "proj-other",
                    title: "Any Client Invoice",
                    amount_due: 1000,
                    currency: "USD",
                    status: "paid",
                    projects: {
                      id: "proj-other",
                      client_id: "other-client",
                      title: "Other Project",
                      clients: { full_name: "Other User", company: "Other Corp" },
                    },
                  },
                }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    });

    mocks.storage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null }),
    });

    const response = await GET(makeRequest("pi-any-003"), {
      params: Promise.resolve({ id: "pi-any-003" }),
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Any Client Invoice");
  });

  it("falls back to demo catalog when invoice matches a catalog item", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "staff_roles") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [] }),
          }),
        };
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
          }),
        };
      }
      if (table === "payment_items") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    });

    const response = await GET(makeRequest("pay-01"), {
      params: Promise.resolve({ id: "pay-01" }),
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("INV-2026-0901");
  });
});
