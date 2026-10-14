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

import { replaceProjectMilestones, saveProject } from "../src/app/[locale]/admin/projects/actions";
import { milestonePlanPayload, projectPayload } from "../src/lib/admin/project-values";

const projectId = "00000000-0000-4000-8000-000000000101";
const clientId = "00000000-0000-4000-8000-000000000102";

function projectForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    locale: "en",
    id: "",
    client_id: clientId,
    title: "  Website rebuild  ",
    description: "New public website",
    status: "on_hold",
    preview_url: "https://preview.example.com",
    starts_on: "2026-10-14",
    due_on: "2026-12-01",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

function mutationBuilder(result = { data: { id: projectId }, error: null }) {
  const builder = { insert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requirePermission.mockResolvedValue({
    user: { id: "00000000-0000-4000-8000-000000000103" },
    supabase: { from: mocks.from, rpc: mocks.rpc },
  });
});

describe("project values", () => {
  it("normalizes a valid project and rejects unsafe preview URLs", () => {
    expect(projectPayload(projectForm())).toEqual(expect.objectContaining({
      client_id: clientId,
      title: "Website rebuild",
      status: "on_hold",
      preview_url: "https://preview.example.com",
    }));
    expect(projectPayload(projectForm({ preview_url: "javascript:alert(1)" }))).toBeNull();
  });

  it("accepts only complete milestone plans totalling 100 percent", () => {
    const plan = JSON.stringify([
      { id: null, title: "Design", description: "", weight: 40, is_done: false, is_client_visible: true, preview_url: "", due_on: "" },
      { id: null, title: "Build", description: "", weight: 60, is_done: false, is_client_visible: true, preview_url: "", due_on: "" },
    ]);
    expect(milestonePlanPayload(plan)).toHaveLength(2);
    expect(milestonePlanPayload(plan.replace('"weight":60', '"weight":50'))).toBeNull();
  });
});

describe("Projects admin actions", () => {
  it("creates new projects on hold even if the submitted status is completed", async () => {
    const builder = mutationBuilder();
    mocks.from.mockReturnValue(builder);
    await expect(saveProject(projectForm({ status: "completed" }))).rejects.toThrow(
      `redirect:/en/admin/projects?edit=${projectId}&saved=project`,
    );
    expect(mocks.requirePermission).toHaveBeenCalledWith("en", "projects.create");
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      client_id: clientId,
      status: "on_hold",
      completed_at: null,
    }));
  });

  it("rejects activation before any database write when weights do not total 100", async () => {
    const milestoneQuery = { select: vi.fn(), eq: vi.fn() };
    milestoneQuery.select.mockReturnValue(milestoneQuery);
    milestoneQuery.eq.mockResolvedValue({ data: [{ weight: 80 }], error: null });
    mocks.from.mockReturnValue(milestoneQuery);
    await expect(saveProject(projectForm({ id: projectId, status: "active" }))).rejects.toThrow(
      `redirect:/en/admin/projects?edit=${projectId}&error=activationNeedsMilestones`,
    );
  });

  it("sends a validated complete milestone plan to the transaction-safe RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const formData = new FormData();
    formData.set("locale", "bn");
    formData.set("project_id", projectId);
    formData.set("milestones", JSON.stringify([
      { id: null, title: "Delivery", description: "", weight: 100, is_done: false, is_client_visible: true, preview_url: "", due_on: "" },
    ]));
    await expect(replaceProjectMilestones(formData)).rejects.toThrow(
      `redirect:/bn/admin/projects?edit=${projectId}&saved=milestones`,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("replace_project_milestones", {
      p_project_id: projectId,
      p_milestones: [expect.objectContaining({ title: "Delivery", weight: 100, sort_order: 0 })],
    });
  });
});
