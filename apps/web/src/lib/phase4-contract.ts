export type Review = {
  id: string
  projectId: string
  rating: number
  text: string
  authorName?: string
  approved: boolean
  featured: boolean
}

export type ReviewEligibility = {
  projectId: string
  eligible: boolean
  reason?: string
}

export type ScheduleSlot = {
  id: string
  startsAt: string
  endsAt: string
  timeZone: string
  durationMinutes: number
}

export type BookingProposal = ScheduleSlot & {
  proposalReference: string
  expiresAt: string
}

export type BookingProposalCard = {
  type: 'booking_proposal'
  proposal: BookingProposal
}
