export interface PortalMilestone {
  id: string;
  title: string;
  description: string;
  weight: number; // 0 - 100
  progress: number; // 0 - 100
  isClientVisible: boolean;
  status: "completed" | "in_progress" | "upcoming";
  targetDate: string;
  completedAt?: string;
}

export interface PortalActivityItem {
  id: string;
  type:
    | "milestone_completed"
    | "preview_deployed"
    | "code_committed"
    | "payment_received"
    | "status_update";
  title: string;
  description: string;
  author: string;
  timestamp: string;
}

export interface PortalPaymentItem {
  id: string;
  title: string;
  amountUsd: number;
  amountBdt: number;
  status: "paid" | "due" | "upcoming" | "overdue";
  dueDate: string;
  paidAt?: string;
  invoiceNumber: string;
  invoiceDownloadUrl?: string;
}

export interface PortalPaymentAlertItem {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  amountUsd: number;
  amountBdt: number;
  dueDate: string;
  status: "due" | "overdue";
  invoiceNumber: string;
  invoiceDownloadUrl?: string;
  isOverdue: boolean;
  daysDiff: number;
}

export interface PortalPaymentAlert {
  hasAlert: boolean;
  severity: "overdue" | "due" | "none";
  overdueCount: number;
  dueSoonCount: number;
  totalOverdueUsd: number;
  totalOverdueBdt: number;
  totalDueUsd: number;
  totalDueBdt: number;
  earliestDueDate?: string;
  items: PortalPaymentAlertItem[];
}

export interface PortalProject {
  id: string;
  title: string;
  clientName: string;
  companyName: string;
  description: string;
  status: "active" | "completed" | "on_hold";
  currentStage: string;
  livePreviewUrl?: string;
  repositoryUrl?: string;
  startDate: string;
  targetCompletionDate: string;
  budgetUsd: number;
  budgetBdt: number;
  milestones: PortalMilestone[];
  activity: PortalActivityItem[];
  payments: PortalPaymentItem[];
}

export interface PortalAppointment {
  id: string;
  meetingTypeNameEn: string;
  meetingTypeNameBn?: string | null;
  startsAt: string;
  endsAt: string;
  bookedAt: string;
  timeZone: string;
  status: "confirmed" | "rescheduled";
}

export interface PortalReview {
  id: string;
  projectId: string;
  clientId?: string | null;
  reviewerName: string;
  reviewerTitle?: string | null;
  rating: number;
  body: string;
  locale: "en" | "bn";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}
