export const projectStatuses = ["on_hold", "active", "completed", "cancelled"] as const;
export const projectMemberRoles = ["lead", "developer", "designer", "qa", "observer"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];
export type ProjectMemberRole = (typeof projectMemberRoles)[number];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function nullable(input: string) {
  return input || null;
}

function validDate(input: string) {
  return !input || /^\d{4}-\d{2}-\d{2}$/.test(input);
}

function validUrl(input: string) {
  if (!input) return true;
  try {
    const url = new URL(input);
    return (url.protocol === "http:" || url.protocol === "https:") && input.length <= 500;
  } catch {
    return false;
  }
}

export function validProjectId(input: string) {
  return uuidPattern.test(input);
}

export function projectPayload(formData: FormData) {
  const clientId = value(formData, "client_id");
  const title = value(formData, "title");
  const description = value(formData, "description");
  const status = value(formData, "status");
  const previewUrl = value(formData, "preview_url");
  const startsOn = value(formData, "starts_on");
  const dueOn = value(formData, "due_on");

  if (
    !validProjectId(clientId)
    || !title
    || title.length > 200
    || description.length > 5000
    || !projectStatuses.includes(status as ProjectStatus)
    || !validUrl(previewUrl)
    || !validDate(startsOn)
    || !validDate(dueOn)
    || (startsOn && dueOn && dueOn < startsOn)
  ) return null;

  return {
    client_id: clientId,
    title,
    description: nullable(description),
    status: status as ProjectStatus,
    preview_url: nullable(previewUrl),
    starts_on: nullable(startsOn),
    due_on: nullable(dueOn),
    completed_at: status === "completed" ? new Date().toISOString() : null,
  };
}

export type MilestoneInput = {
  id: string | null;
  title: string;
  description: string | null;
  weight: number;
  is_done: boolean;
  is_client_visible: boolean;
  preview_url: string | null;
  due_on: string | null;
  sort_order: number;
};

export function milestonePlanPayload(input: string): MilestoneInput[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 100) return null;

  const ids = new Set<string>();
  const result: MilestoneInput[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const row = raw[index];
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" && item.id ? item.id : null;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const weight = typeof item.weight === "number" ? item.weight : Number(item.weight);
    const previewUrl = typeof item.preview_url === "string" ? item.preview_url.trim() : "";
    const dueOn = typeof item.due_on === "string" ? item.due_on.trim() : "";
    if (
      (id !== null && (!validProjectId(id) || ids.has(id)))
      || !title
      || title.length > 200
      || description.length > 3000
      || !Number.isFinite(weight)
      || weight <= 0
      || weight > 100
      || !validUrl(previewUrl)
      || !validDate(dueOn)
      || typeof item.is_done !== "boolean"
      || typeof item.is_client_visible !== "boolean"
    ) return null;
    if (id) ids.add(id);
    result.push({
      id,
      title,
      description: nullable(description),
      weight: Math.round(weight * 100) / 100,
      is_done: item.is_done,
      is_client_visible: item.is_client_visible,
      preview_url: nullable(previewUrl),
      due_on: nullable(dueOn),
      sort_order: index,
    });
  }

  const total = result.reduce((sum, row) => sum + row.weight, 0);
  return Math.abs(total - 100) < 0.001 ? result : null;
}

export function validProjectMemberRole(input: string): input is ProjectMemberRole {
  return projectMemberRoles.includes(input as ProjectMemberRole);
}
