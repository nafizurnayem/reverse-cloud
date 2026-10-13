import type { PortalMilestone } from "./types";

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
