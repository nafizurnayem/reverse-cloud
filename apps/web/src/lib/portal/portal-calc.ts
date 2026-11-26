import type {
  PortalMilestone,
  PortalPaymentAlert,
  PortalPaymentAlertItem,
  PortalProject,
} from "./types";

/**
 * Calculates the overall progress percentage for clients.
 * Invariant: Milestones with isClientVisible = false MUST be excluded entirely
 * so visible weights and displayed progress always sum up predictably.
 */
export function calculateClientProgress(milestones: PortalMilestone[]): number {
  const visible = milestones.filter((m) => m.isClientVisible);
  if (visible.length === 0) return 0;

  const totalWeight = visible.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight <= 0) {
    // If weights are unassigned or 0, fallback to arithmetic mean of visible progress
    const totalProgress = visible.reduce((sum, m) => sum + m.progress, 0);
    return Math.round(totalProgress / visible.length);
  }

  const weightedProgress = visible.reduce(
    (sum, m) => sum + (m.weight * Math.min(100, Math.max(0, m.progress))),
    0,
  );

  return Math.min(100, Math.max(0, Math.round(weightedProgress / totalWeight)));
}

/**
 * Calculates full internal progress across ALL milestones (including internal-only tasks)
 * for Admin and Project Manager views.
 */
export function calculateInternalProgress(milestones: PortalMilestone[]): number {
  if (milestones.length === 0) return 0;

  const totalWeight = milestones.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight <= 0) {
    const totalProgress = milestones.reduce((sum, m) => sum + m.progress, 0);
    return Math.round(totalProgress / milestones.length);
  }

  const weightedProgress = milestones.reduce(
    (sum, m) => sum + (m.weight * Math.min(100, Math.max(0, m.progress))),
    0,
  );

  return Math.min(100, Math.max(0, Math.round(weightedProgress / totalWeight)));
}

/**
 * Evaluates payment items across projects and returns high-priority payment alerts
 * (overdue invoices, due soon notices, and payment totals).
 */
export function calculatePaymentAlerts(
  projects: PortalProject[],
  now: Date = new Date(),
): PortalPaymentAlert {
  const todayStr = now.toISOString().slice(0, 10);
  const today = new Date(todayStr);

  const alertItems: PortalPaymentAlertItem[] = [];

  for (const project of projects) {
    for (const payment of project.payments ?? []) {
      if (payment.status === "paid") continue;

      let isOverdue = false;
      let isDue = false;
      let daysDiff = 0;

      if (payment.dueDate) {
        const dueDate = new Date(payment.dueDate.slice(0, 10));
        const diffMs = dueDate.getTime() - today.getTime();
        daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (payment.status === "overdue" || daysDiff < 0) {
          isOverdue = true;
        } else if (daysDiff <= 14 || payment.status === "due") {
          isDue = true;
        }
      } else if (payment.status === "overdue") {
        isOverdue = true;
      } else if (payment.status === "due") {
        isDue = true;
      }

      if (isOverdue || isDue) {
        alertItems.push({
          id: payment.id,
          projectId: project.id,
          projectTitle: project.title,
          title: payment.title,
          amountUsd: payment.amountUsd,
          amountBdt: payment.amountBdt,
          dueDate: payment.dueDate,
          status: isOverdue ? "overdue" : "due",
          invoiceNumber: payment.invoiceNumber,
          invoiceDownloadUrl: payment.invoiceDownloadUrl,
          isOverdue,
          daysDiff,
        });
      }
    }
  }

  // Sort: overdue first (most days overdue first), then upcoming due soon
  alertItems.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.daysDiff - b.daysDiff;
  });

  const overdueItems = alertItems.filter((i) => i.isOverdue);
  const dueItems = alertItems.filter((i) => !i.isOverdue);

  const totalOverdueUsd = overdueItems.reduce((sum, i) => sum + i.amountUsd, 0);
  const totalOverdueBdt = overdueItems.reduce((sum, i) => sum + i.amountBdt, 0);
  const totalDueUsd = dueItems.reduce((sum, i) => sum + i.amountUsd, 0);
  const totalDueBdt = dueItems.reduce((sum, i) => sum + i.amountBdt, 0);

  const earliestDueDate = alertItems[0]?.dueDate;
  const severity: "overdue" | "due" | "none" =
    overdueItems.length > 0 ? "overdue" : dueItems.length > 0 ? "due" : "none";

  return {
    hasAlert: alertItems.length > 0,
    severity,
    overdueCount: overdueItems.length,
    dueSoonCount: dueItems.length,
    totalOverdueUsd,
    totalOverdueBdt,
    totalDueUsd,
    totalDueBdt,
    earliestDueDate,
    items: alertItems,
  };
}
