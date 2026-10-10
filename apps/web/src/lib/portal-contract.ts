export type ProjectStatus = 'planned' | 'active' | 'paused' | 'complete'
export type MilestoneStatus = 'pending' | 'active' | 'complete' | 'blocked'
export type PaymentStatus = 'scheduled' | 'due' | 'paid' | 'overdue'

export type PortalProject = {
  id: string
  title: string
  code: string
  status: ProjectStatus
  progress: number
  dueDate?: string
  summary?: string
  previewUrl?: string
  milestones: PortalMilestone[]
  activities: PortalActivity[]
  payments: PortalPayment[]
}

export type PortalMilestone = {
  id: string
  title: string
  weightPercent: number
  progressPercent: number
  startDate?: string
  dueDate?: string
  status: MilestoneStatus
}

export type PortalActivity = {
  id: string
  occurredAt: string
  summary: string
  clientVisible: boolean
}

export type PortalPayment = {
  id: string
  amount: number
  currency: 'BDT' | 'USD'
  dueDate: string
  status: PaymentStatus
}

export type PortalDataState =
  | { status: 'loading' }
  | { status: 'unauthenticated' | 'unavailable' | 'error'; message: string }
  | { status: 'ready'; projects: PortalProject[] }
