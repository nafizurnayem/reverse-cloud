import { describe, expect, it } from "vitest";
import {
  calculateClientProgress,
  calculateInternalProgress,
} from "../src/lib/portal/portal-calc";
import {
  getPortalProjectById,
  getPortalProjects,
} from "../src/lib/portal/portal-catalog";
import type { PortalMilestone } from "../src/lib/portal/types";

describe("Portal Calculation & Invariants", () => {
  it("strictly excludes isClientVisible = false milestones from client progress", () => {
    const milestones: PortalMilestone[] = [
      {
        id: "m-1",
        title: "Design",
        description: "",
        weight: 25,
        progress: 100,
        isClientVisible: true,
        status: "completed",
        targetDate: "2026-09-01",
      },
      {
        id: "m-2",
        title: "Database",
        description: "",
        weight: 35,
        progress: 100,
        isClientVisible: true,
        status: "completed",
        targetDate: "2026-09-15",
      },
      {
        id: "m-3",
        title: "Internal Audit (Hidden)",
        description: "",
        weight: 15,
        progress: 40,
        isClientVisible: false, // Internal hidden milestone!
        status: "in_progress",
        targetDate: "2026-09-20",
      },
      {
        id: "m-4",
        title: "Staging",
        description: "",
        weight: 25,
        progress: 70,
        isClientVisible: true,
        status: "in_progress",
        targetDate: "2026-09-30",
      },
      {
        id: "m-5",
        title: "Handoff",
        description: "",
        weight: 15,
        progress: 0,
        isClientVisible: true,
        status: "upcoming",
        targetDate: "2026-10-15",
      },
    ];

    const clientProgress = calculateClientProgress(milestones);
    const internalProgress = calculateInternalProgress(milestones);

    // Visible sum: (25*100 + 35*100 + 25*70 + 15*0) / 100 = 77.5 => 78%
    expect(clientProgress).toBe(78);

    // Internal sum: (7750 + 15*40) / 115 = 8350 / 115 => 73%
    expect(internalProgress).toBe(73);

    // Verifies client progress diverges cleanly from internal progress due to hidden milestone
    expect(clientProgress).not.toBe(internalProgress);
  });

  it("handles empty and 100% boundary conditions", () => {
    expect(calculateClientProgress([])).toBe(0);

    const completedMilestones: PortalMilestone[] = [
      {
        id: "c-1",
        title: "Full Launch",
        description: "",
        weight: 100,
        progress: 100,
        isClientVisible: true,
        status: "completed",
        targetDate: "2026-09-01",
      },
    ];
    expect(calculateClientProgress(completedMilestones)).toBe(100);
  });

  it("retrieves portal projects from catalog", () => {
    const projects = getPortalProjects();
    expect(projects.length).toBeGreaterThan(0);

    const project = getPortalProjectById("proj-fintech-01");
    expect(project).toBeDefined();
    expect(project?.title).toContain("Fintech Cloud Migration");
    expect(project?.livePreviewUrl).toContain("https://");
    expect(project?.payments.length).toBeGreaterThan(0);
    expect(project?.activity.length).toBeGreaterThan(0);
  });
});
