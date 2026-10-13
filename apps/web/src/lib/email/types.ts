export type EmailLocale = "en" | "bn";

export type EmailTemplateType =
  | "invite"
  | "project_activated"
  | "milestone_updated"
  | "payment_due"
  | "delivered";

export interface BaseEmailContext {
  recipientName: string;
  companyName?: string;
  locale?: EmailLocale;
  baseUrl?: string;
}

export interface InviteEmailContext extends BaseEmailContext {
  inviteUrl: string;
  expiresInHours?: number;
}

export interface ProjectActivatedEmailContext extends BaseEmailContext {
  projectTitle: string;
  portalUrl: string;
  leadArchitect?: string;
  startDate?: string;
}

export interface MilestoneUpdatedEmailContext extends BaseEmailContext {
  projectTitle: string;
  milestoneTitle: string;
  progressPercent: number;
  status: "in_progress" | "completed";
  portalUrl: string;
}

export interface PaymentDueEmailContext extends BaseEmailContext {
  projectTitle: string;
  milestoneTitle: string;
  amountUsd: number;
  amountBdt: number;
  dueDate: string;
  invoiceNumber: string;
  invoiceUrl: string;
}

export interface DeliveredEmailContext extends BaseEmailContext {
  projectTitle: string;
  portalUrl: string;
  warrantyDays?: number;
  documentationUrl?: string;
}

export type EmailContextMap = {
  invite: InviteEmailContext;
  project_activated: ProjectActivatedEmailContext;
  milestone_updated: MilestoneUpdatedEmailContext;
  payment_due: PaymentDueEmailContext;
  delivered: DeliveredEmailContext;
};

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
