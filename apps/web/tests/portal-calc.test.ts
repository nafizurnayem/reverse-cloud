import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  calculateClientProgress,
  calculateInternalProgress,
  calculatePaymentAlerts,
} from "../src/lib/portal/portal-calc";
import {
  getPortalProjectById,
  getPortalProjects,
} from "../src/lib/portal/portal-catalog";
import {
  mapDbProjectToPortalProject,
  type DbProjectRow,
} from "../src/lib/portal/portal-server";
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

  it("maps real DB project, milestone, update, and payment rows accurately", () => {
    const dbRow: DbProjectRow = {
      id: "12345678-0000-0000-0000-000000000001",
      client_id: "client-uuid-1",
      title: "Real DB Cloud Migration",
      description: "Migration to GCP Cloud Run and BigQuery",
      status: "active",
      preview_url: "https://staging.realproject.app",
      progress_pct: 60,
      client_progress_pct: 60,
      starts_on: "2026-08-01",
      due_on: "2026-11-30",
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-15T10:00:00Z",
      clients: {
        full_name: "Tariqul Islam",
        company: "Alpha FinTech",
      },
      milestones: [
        {
          id: "m-uuid-1",
          project_id: "12345678-0000-0000-0000-000000000001",
          title: "Architecture Design",
          description: "System diagram & threat modeling",
          weight: "40",
          is_done: true,
          is_client_visible: true,
          preview_url: null,
          due_on: "2026-08-30",
          done_at: "2026-08-28T12:00:00Z",
        },
        {
          id: "m-uuid-2",
          project_id: "12345678-0000-0000-0000-000000000001",
          title: "Private Security Review",
          description: "Internal team pentest",
          weight: "20",
          is_done: false,
          is_client_visible: false, // Internal milestone
          preview_url: null,
          due_on: "2026-09-15",
          done_at: null,
        },
        {
          id: "m-uuid-3",
          project_id: "12345678-0000-0000-0000-000000000001",
          title: "Staging Deployment",
          description: "Container deployment to Cloud Run",
          weight: "60",
          is_done: false,
          is_client_visible: true,
          preview_url: "https://staging.realproject.app",
          due_on: "2026-11-30",
          done_at: null,
        },
      ],
      project_updates: [
        {
          id: "upd-1",
          project_id: "12345678-0000-0000-0000-000000000001",
          author_id: "author-1",
          body: "Architecture blueprint approved by security team.",
          is_client_visible: true,
          created_at: "2026-08-28T14:00:00Z",
        },
      ],
      payment_items: [
        {
          id: "pi-uuid-1",
          project_id: "12345678-0000-0000-0000-000000000001",
          title: "Deposit (50%)",
          description: "Project kickoff payment",
          amount_due: "5000.00",
          currency: "USD",
          status: "paid",
          due_on: "2026-08-05",
          paid_at: "2026-08-04T10:00:00Z",
        },
        {
          id: "pi-uuid-2",
          project_id: "12345678-0000-0000-0000-000000000001",
          title: "Final Delivery (50%)",
          description: "On signoff",
          amount_due: "5000.00",
          currency: "USD",
          status: "pending",
          due_on: "2026-11-30",
          paid_at: null,
        },
      ],
    };

    const mapped = mapDbProjectToPortalProject(dbRow);

    expect(mapped.id).toBe("12345678-0000-0000-0000-000000000001");
    expect(mapped.title).toBe("Real DB Cloud Migration");
    expect(mapped.clientName).toBe("Tariqul Islam");
    expect(mapped.companyName).toBe("Alpha FinTech");
    expect(mapped.livePreviewUrl).toBe("https://staging.realproject.app");
    expect(mapped.startDate).toBe("2026-08-01");
    expect(mapped.targetCompletionDate).toBe("2026-11-30");

    // Total budget dynamically calculated from payments ($5000 + $5000 = $10,000)
    expect(mapped.budgetUsd).toBe(10000);
    expect(mapped.budgetBdt).toBe(1200000);

    // Milestones check
    expect(mapped.milestones.length).toBe(3);
    const visibleMilestones = mapped.milestones.filter((m) => m.isClientVisible);
    expect(visibleMilestones.length).toBe(2);

    // Client progress on mapped milestones:
    // visible: Architecture (weight 40, 100%) + Staging (weight 60, 0%) => (40*100) / 100 = 40%
    const progress = calculateClientProgress(mapped.milestones);
    expect(progress).toBe(40);

    // Updates & Activity
    expect(mapped.activity.length).toBe(1);
    expect(mapped.activity[0].description).toBe("Architecture blueprint approved by security team.");

    // Payment items & Invoices
    expect(mapped.payments.length).toBe(2);
    expect(mapped.payments[0].status).toBe("paid");
    expect(mapped.payments[0].invoiceNumber).toBe("INV-PI-UUID-");
    expect(mapped.payments[0].invoiceDownloadUrl).toBe("/api/invoices/pi-uuid-1");
    expect(mapped.payments[1].status).toBe("due");
  });

  describe("Payment Alert Calculations", () => {
    const fixedNow = new Date("2026-11-20T12:00:00Z");

    it("returns no alert for empty projects or when all payments are paid", () => {
      expect(calculatePaymentAlerts([], fixedNow)).toEqual({
        hasAlert: false,
        severity: "none",
        overdueCount: 0,
        dueSoonCount: 0,
        totalOverdueUsd: 0,
        totalOverdueBdt: 0,
        totalDueUsd: 0,
        totalDueBdt: 0,
        earliestDueDate: undefined,
        items: [],
      });

      const fullyPaidProjects = [
        {
          id: "p-paid",
          title: "Paid Project",
          clientName: "Client",
          companyName: "Company",
          description: "",
          status: "completed" as const,
          currentStage: "Done",
          startDate: "2026-01-01",
          targetCompletionDate: "2026-02-01",
          budgetUsd: 5000,
          budgetBdt: 600000,
          milestones: [],
          activity: [],
          payments: [
            {
              id: "pay-1",
              title: "Deposit",
              amountUsd: 5000,
              amountBdt: 600000,
              status: "paid" as const,
              dueDate: "2026-01-05",
              invoiceNumber: "INV-001",
            },
          ],
        },
      ];

      const alert = calculatePaymentAlerts(fullyPaidProjects, fixedNow);
      expect(alert.hasAlert).toBe(false);
      expect(alert.severity).toBe("none");
    });

    it("detects overdue payments accurately", () => {
      const overdueProjects = [
        {
          id: "p-overdue",
          title: "Overdue Project",
          clientName: "Client",
          companyName: "Company",
          description: "",
          status: "active" as const,
          currentStage: "Testing",
          startDate: "2026-09-01",
          targetCompletionDate: "2026-11-15",
          budgetUsd: 3000,
          budgetBdt: 360000,
          milestones: [],
          activity: [],
          payments: [
            {
              id: "pay-overdue-1",
              title: "Milestone 2 Due",
              amountUsd: 2000,
              amountBdt: 240000,
              status: "due" as const,
              dueDate: "2026-11-10", // 10 days before fixedNow (2026-11-20)
              invoiceNumber: "INV-OVERDUE",
            },
          ],
        },
      ];

      const alert = calculatePaymentAlerts(overdueProjects, fixedNow);
      expect(alert.hasAlert).toBe(true);
      expect(alert.severity).toBe("overdue");
      expect(alert.overdueCount).toBe(1);
      expect(alert.totalOverdueUsd).toBe(2000);
      expect(alert.totalOverdueBdt).toBe(240000);
      expect(alert.items[0].isOverdue).toBe(true);
      expect(alert.items[0].daysDiff).toBe(-10);
    });

    it("detects upcoming due soon payments and prioritizes overdue first", () => {
      const mixedProjects = [
        {
          id: "p-mixed",
          title: "Mixed Project",
          clientName: "Client",
          companyName: "Company",
          description: "",
          status: "active" as const,
          currentStage: "Development",
          startDate: "2026-10-01",
          targetCompletionDate: "2026-12-01",
          budgetUsd: 8000,
          budgetBdt: 960000,
          milestones: [],
          activity: [],
          payments: [
            {
              id: "pay-soon",
              title: "Due in 5 days",
              amountUsd: 3000,
              amountBdt: 360000,
              status: "upcoming" as const,
              dueDate: "2026-11-25", // 5 days after fixedNow (2026-11-20)
              invoiceNumber: "INV-SOON",
            },
            {
              id: "pay-late",
              title: "Late Milestone",
              amountUsd: 1500,
              amountBdt: 180000,
              status: "overdue" as const,
              dueDate: "2026-11-01",
              invoiceNumber: "INV-LATE",
            },
          ],
        },
      ];

      const alert = calculatePaymentAlerts(mixedProjects, fixedNow);
      expect(alert.hasAlert).toBe(true);
      expect(alert.severity).toBe("overdue");
      expect(alert.overdueCount).toBe(1);
      expect(alert.dueSoonCount).toBe(1);
      expect(alert.totalOverdueUsd).toBe(1500);
      expect(alert.totalDueUsd).toBe(3000);
      // Overdue is sorted first
      expect(alert.items[0].id).toBe("pay-late");
      expect(alert.items[1].id).toBe("pay-soon");
    });
  });
});
