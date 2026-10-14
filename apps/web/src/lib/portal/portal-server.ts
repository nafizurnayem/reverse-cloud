import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPortalProjects, getPortalProjectById } from "./portal-catalog";
import type {
  PortalActivityItem,
  PortalMilestone,
  PortalPaymentItem,
  PortalProject,
} from "./types";

interface DbMilestoneRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  weight: number | string;
  is_done: boolean;
  is_client_visible: boolean;
  preview_url: string | null;
  due_on: string | null;
  done_at: string | null;
}

interface DbUpdateRow {
  id: string;
  project_id: string;
  author_id: string | null;
  body: string;
  is_client_visible: boolean;
  created_at: string;
}

interface DbPaymentItemRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  amount_due: number | string;
  currency: string;
  status: string;
  due_on: string | null;
  paid_at: string | null;
}

export interface DbProjectRow {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: string;
  preview_url: string | null;
  progress_pct: number | null;
  client_progress_pct: number | null;
  budget_currency?: string | null;
  budget_amount?: number | null;
  starts_on?: string | null;
  due_on?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  clients?: { full_name: string; company: string | null } | null;
  milestones?: DbMilestoneRow[];
  project_updates?: DbUpdateRow[];
  payment_items?: DbPaymentItemRow[];
}

export function mapDbProjectToPortalProject(p: DbProjectRow): PortalProject {
  const milestones: PortalMilestone[] = (p.milestones ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description ?? "",
    weight: Number(m.weight),
    progress: m.is_done ? 100 : 0,
    isClientVisible: m.is_client_visible,
    status: m.is_done ? "completed" : "in_progress",
    targetDate: m.due_on ?? "",
    completedAt: m.done_at ?? undefined,
  }));

  const visibleMilestones = milestones.filter((m) => m.isClientVisible);
  const nextIncomplete = visibleMilestones.find((m) => m.progress < 100);
  const currentStage =
    p.status === "completed"
      ? "Production Completed"
      : nextIncomplete
      ? nextIncomplete.title
      : "Active Development";

  const targetDates = visibleMilestones
    .map((m) => m.targetDate)
    .filter(Boolean)
    .sort();
  const targetCompletionDate =
    p.due_on ??
    (targetDates.length > 0
      ? targetDates[targetDates.length - 1]
      : p.created_at.slice(0, 10));

  const startDate = p.starts_on ?? p.created_at.slice(0, 10);

  const payments: PortalPaymentItem[] = (p.payment_items ?? []).map((pi) => {
    const amount = Number(pi.amount_due);
    const isPiBdt = pi.currency === "BDT";
    return {
      id: pi.id,
      title: pi.title,
      amountUsd: isPiBdt ? Math.round(amount / 120) : amount,
      amountBdt: isPiBdt ? amount : Math.round(amount * 120),
      status: pi.status === "paid" ? "paid" : pi.status === "pending" ? "due" : "upcoming",
      dueDate: pi.due_on ?? "",
      paidAt: pi.paid_at ?? undefined,
      invoiceNumber: `INV-${pi.id.slice(0, 8).toUpperCase()}`,
      invoiceDownloadUrl: `/api/invoices/${pi.id}`,
    };
  });

  const totalUsdFromPayments = payments.reduce((sum, item) => sum + item.amountUsd, 0);
  const totalBdtFromPayments = payments.reduce((sum, item) => sum + item.amountBdt, 0);

  const rawBudget = Number(p.budget_amount ?? 0);
  const isBdt = p.budget_currency === "BDT";
  const budgetUsd = p.budget_amount != null
    ? (isBdt ? Math.round(rawBudget / 120) : rawBudget)
    : totalUsdFromPayments;
  const budgetBdt = p.budget_amount != null
    ? (isBdt ? rawBudget : Math.round(rawBudget * 120))
    : totalBdtFromPayments;

  const activity: PortalActivityItem[] = (p.project_updates ?? []).map((u) => ({
    id: u.id,
    type: "status_update",
    title: "Project Progress Update",
    description: u.body,
    author: "Engineering Lead",
    timestamp: u.created_at,
  }));

  return {
    id: p.id,
    title: p.title,
    clientName: p.clients?.full_name ?? "Client",
    companyName: p.clients?.company ?? "Client Organization",
    description: p.description ?? "",
    status: p.status === "completed" ? "completed" : p.status === "on_hold" ? "on_hold" : "active",
    currentStage,
    livePreviewUrl: p.preview_url ?? undefined,
    startDate,
    targetCompletionDate,
    budgetUsd,
    budgetBdt,
    milestones,
    activity,
    payments,
  };
}

export async function fetchClientProjects(): Promise<PortalProject[]> {
  try {
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return getPortalProjects();
    }

    const { data: dbProjects, error } = await supabase
      .from("projects")
      .select(`
        *,
        clients:client_id(full_name, company),
        milestones(id, title, description, weight, is_done, is_client_visible, preview_url, due_on, done_at)
      `)
      .order("created_at", { ascending: false });

    if (error || !dbProjects || dbProjects.length === 0) {
      return getPortalProjects();
    }

    return (dbProjects as unknown as DbProjectRow[]).map(mapDbProjectToPortalProject);
  } catch {
    return getPortalProjects();
  }
}

export async function fetchClientProjectById(id: string): Promise<PortalProject | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select(`
        *,
        clients:client_id(full_name, company),
        milestones(id, title, description, weight, is_done, is_client_visible, preview_url, due_on, done_at),
        project_updates(id, body, is_client_visible, created_at, author_id),
        payment_items(id, title, description, amount_due, currency, status, due_on, paid_at)
      `)
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return mapDbProjectToPortalProject(data as unknown as DbProjectRow);
    }

    return getPortalProjectById(id) ?? null;
  } catch {
    return getPortalProjectById(id) ?? null;
  }
}
