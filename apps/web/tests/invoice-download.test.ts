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

const ids = {
  unauthorized: "11111111-1111-4111-8111-111111111111",
  otherClient: "22222222-2222-4222-8222-222222222222",
  storedPdf: "33333333-3333-4333-8333-333333333333",
  printable: "44444444-4444-4444-8444-444444444444",
  staff: "55555555-5555-4555-8555-555555555555",
  missing: "66666666-6666-4666-8666-666666666666",
};

function makeRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/invoices/${id}`);
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function paymentItem(id: string, clientId = "client-a-id") {
  return {
    id,
    project_id: "77777777-7777-4777-8777-777777777777",
    title: "Final Delivery Installment",
    description: "Production delivery",
    amount_due: 2500,
    currency: "USD",
    status: "pending",
    due_on: "2026-11-15",
    paid_at: null,
    projects: {
      id: "77777777-7777-4777-8777-777777777777",
      client_id: clientId,
      title: "Microservices Modernization",
      clients: {
        id: clientId,
        full_name: "Rahim Chowdhury",
        company: "FinTech BD",
        email: "rahim@example.com",
      },
    },
  };
}

function mockDatabase({
  clientId = "client-a-id",
  item = null,
  permissions = [],
}: {
  clientId?: string | null;
  item?: ReturnType<typeof paymentItem> | null;
  permissions?: string[];
} = {}) {
  mocks.from.mockImplementation((table: string) => {
    if (table === "staff_roles") {
      return {
        select: () => ({
          eq: () => Promise.resolve({
            data: permissions.length
              ? [{ roles: { role_permissions: permissions.map((permission_key) => ({ permission_key })) } }]
              : [],
          }),
        }),
      };
    }
    if (table === "clients") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: clientId ? { id: clientId } : null }),
          }),
        }),
      };
    }
    if (table === "payment_items") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: item }) }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
}

describe("invoice download route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.storage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: new Error("not found") }),
    });
  });

  it("returns 404 for a malformed invoice ID before authentication or database queries", async () => {
    const response = await GET(makeRequest("not-a-uuid"), context("not-a-uuid"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Invoice not found" });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns 401 when a valid invoice ID is requested without a session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("No session") });

    const response = await GET(makeRequest(ids.unauthorized), context(ids.unauthorized));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when a client requests another client's invoice", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-client-b" } }, error: null });
    mockDatabase({
      clientId: "client-b-id",
      item: paymentItem(ids.otherClient, "client-a-id"),
    });

    const response = await GET(makeRequest(ids.otherClient), context(ids.otherClient));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Invoice not found" });
    expect(mocks.storage.from).not.toHaveBeenCalled();
  });

  it("redirects to a signed private-storage URL when a PDF exists", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-client-a" } }, error: null });
    mockDatabase({ item: paymentItem(ids.storedPdf) });
    mocks.storage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.example/private/invoice.pdf?token=secret" },
        error: null,
      }),
    });

    const response = await GET(makeRequest(ids.storedPdf), context(ids.storedPdf));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://storage.example/private/invoice.pdf?token=secret",
    );
  });

  it("escapes database text and applies a restrictive CSP to printable HTML", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-client-a" } }, error: null });
    const item = paymentItem(ids.printable);
    item.title = `<script>alert("invoice")</script>`;
    item.description = `<img src=x onerror="alert(1)">`;
    item.projects.title = "Platform <Migration> & Delivery";
    item.projects.clients.full_name = "Rahim <Admin>";
    item.projects.clients.company = "FinTech & Partners";
    mockDatabase({ item });

    const response = await GET(makeRequest(ids.printable), context(ids.printable));
    const html = await response.text();

    expect(response.status).toBe(200);
    const csp = response.headers.get("content-security-policy") ?? "";
    const nonce = csp.match(/script-src 'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).not.toContain("script-src 'unsafe-inline'");
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(html).toContain("&lt;script&gt;alert(&quot;invoice&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("Platform &lt;Migration&gt; &amp; Delivery");
    expect(html).toContain("Rahim &lt;Admin&gt;");
    expect(html).toContain("FinTech &amp; Partners");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });

  it("allows staff with payments.read to access an invoice", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "staff-user" } }, error: null });
    const item = paymentItem(ids.staff, "another-client-id");
    item.title = "Any Client Invoice";
    mockDatabase({ clientId: null, item, permissions: ["payments.read"] });

    const response = await GET(makeRequest(ids.staff), context(ids.staff));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Any Client Invoice");
  });

  it("returns 404 for a missing valid invoice instead of demo data", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-client-a" } }, error: null });
    mockDatabase({ item: null });

    const response = await GET(makeRequest(ids.missing), context(ids.missing));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Invoice not found" });
    expect(mocks.storage.from).not.toHaveBeenCalled();
  });
});
