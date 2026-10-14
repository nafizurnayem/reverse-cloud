export const paymentItemStatuses = ["pending", "paid", "overdue", "cancelled"] as const;
export const paymentMethods = ["bank_transfer", "card", "mobile_banking", "cash", "crypto", "other"] as const;

export type PaymentItemStatus = (typeof paymentItemStatuses)[number];
export type PaymentMethod = (typeof paymentMethods)[number];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function nullable(input: string) {
  return input || null;
}

export function validPaymentId(input: string) {
  return uuidPattern.test(input);
}

export function paymentItemPayload(formData: FormData) {
  const projectId = value(formData, "project_id");
  const title = value(formData, "title");
  const description = value(formData, "description");
  const amountDue = Number(value(formData, "amount_due"));
  const currency = value(formData, "currency").toUpperCase();
  const status = value(formData, "status");
  const dueOn = value(formData, "due_on");
  const sortOrder = Number(value(formData, "sort_order") || "0");
  if (!validPaymentId(projectId) || !title || title.length > 200 || description.length > 2000
    || !Number.isFinite(amountDue) || amountDue <= 0 || !/^[A-Z]{3}$/.test(currency)
    || !paymentItemStatuses.includes(status as PaymentItemStatus)
    || (dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) || !Number.isInteger(sortOrder)) return null;
  return { project_id: projectId, title, description: nullable(description), amount_due: Math.round(amountDue * 100) / 100, currency, status: status as PaymentItemStatus, due_on: nullable(dueOn), sort_order: sortOrder };
}

export function paymentPayload(formData: FormData) {
  const paymentItemId = value(formData, "payment_item_id");
  const currency = value(formData, "currency").toUpperCase();
  const amountPaid = Number(value(formData, "amount_paid"));
  const paidAt = value(formData, "paid_at");
  const method = value(formData, "method");
  const reference = value(formData, "reference");
  const notes = value(formData, "notes");
  if (!validPaymentId(paymentItemId) || !/^[A-Z]{3}$/.test(currency)
    || !Number.isFinite(amountPaid) || amountPaid <= 0 || !paidAt || Number.isNaN(Date.parse(paidAt))
    || !paymentMethods.includes(method as PaymentMethod) || reference.length > 200 || notes.length > 2000) return null;
  return { payment_item_id: paymentItemId, currency, amount_paid: Math.round(amountPaid * 100) / 100, paid_at: new Date(paidAt).toISOString(), method: method as PaymentMethod, reference: nullable(reference), notes: nullable(notes) };
}
