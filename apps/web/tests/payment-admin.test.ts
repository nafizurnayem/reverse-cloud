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

import { savePayment, savePaymentItem, voidPayment } from "../src/app/[locale]/admin/payments/actions";
import { paymentItemPayload, paymentPayload } from "../src/lib/admin/payment-values";

const projectId = "00000000-0000-4000-8000-000000000201";
const itemId = "00000000-0000-4000-8000-000000000202";
const paymentId = "00000000-0000-4000-8000-000000000203";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function itemForm(overrides: Record<string, string> = {}) {
  return form({ locale: "en", id: "", project_id: projectId, title: "  Initial deposit  ", description: "30% deposit", amount_due: "1250.50", currency: "usd", status: "pending", due_on: "2026-11-01", sort_order: "1", ...overrides });
}

function paymentForm(overrides: Record<string, string> = {}) {
  return form({ locale: "en", id: "", payment_item_id: itemId, currency: "usd", amount_paid: "500.25", paid_at: "2026-10-14T12:30", method: "bank_transfer", reference: "TX-100", notes: "Confirmed", ...overrides });
}

function builder(result = { data: { id: itemId }, error: null }) {
  const value = { insert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
  value.insert.mockReturnValue(value); value.update.mockReturnValue(value); value.eq.mockReturnValue(value); value.select.mockReturnValue(value); value.single.mockResolvedValue(result);
  return value;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: paymentId, error: null });
  mocks.requirePermission.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000204" }, supabase: { from: mocks.from, rpc: mocks.rpc } });
});

describe("payment values", () => {
  it("normalizes currency and monetary values", () => {
    expect(paymentItemPayload(itemForm())).toEqual(expect.objectContaining({ title: "Initial deposit", amount_due: 1250.5, currency: "USD", status: "pending" }));
    expect(paymentPayload(paymentForm())).toEqual(expect.objectContaining({ payment_item_id: itemId, amount_paid: 500.25, currency: "USD", method: "bank_transfer" }));
  });

  it("rejects invalid currencies, amounts and payment methods", () => {
    expect(paymentItemPayload(itemForm({ currency: "US", amount_due: "0" }))).toBeNull();
    expect(paymentPayload(paymentForm({ method: "cheque" }))).toBeNull();
  });
});

describe("payment actions", () => {
  it("creates an installment with the authenticated recorder", async () => {
    const query = builder(); mocks.from.mockReturnValue(query);
    await expect(savePaymentItem(itemForm())).rejects.toThrow(`redirect:/en/admin/payments?item=${itemId}&saved=item`);
    expect(mocks.requirePermission).toHaveBeenCalledWith("en", "payments.manage");
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ project_id: projectId, currency: "USD", created_by: expect.any(String) }));
  });

  it("records currency-safe payment details", async () => {
    const query = builder({ data: { id: paymentId }, error: null }); mocks.from.mockReturnValue(query);
    await expect(savePayment(paymentForm())).rejects.toThrow(`redirect:/en/admin/payments?item=${itemId}&saved=payment`);
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ payment_item_id: itemId, currency: "USD", amount_paid: 500.25, recorded_by: expect.any(String) }));
  });

  it("corrects mutable payment fields without moving a record to another installment", async () => {
    const query = builder(); query.eq.mockResolvedValue({ data: null, error: null }); mocks.from.mockReturnValue(query);
    await expect(savePayment(paymentForm({ id: paymentId }))).rejects.toThrow(`redirect:/en/admin/payments?item=${itemId}&saved=payment`);
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ amount_paid: 500.25, reference: "TX-100" }));
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("payment_item_id");
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("currency");
  });

  it("voids a payment through the restricted RPC with an audit reason", async () => {
    const data = form({ locale: "bn", payment_item_id: itemId, payment_id: paymentId, reason: "Transfer reversed" });
    await expect(voidPayment(data)).rejects.toThrow(`redirect:/bn/admin/payments?item=${itemId}&saved=voided`);
    expect(mocks.requirePermission).toHaveBeenCalledWith("bn", "payments.manage");
    expect(mocks.rpc).toHaveBeenCalledWith("void_payment", {
      p_payment_id: paymentId,
      p_reason: "Transfer reversed",
    });
  });

  it("rejects a void without a valid reason before calling the database", async () => {
    const data = form({ locale: "en", payment_item_id: itemId, payment_id: paymentId, reason: "" });
    await expect(voidPayment(data)).rejects.toThrow(`redirect:/en/admin/payments?item=${itemId}&error=invalidVoid`);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
