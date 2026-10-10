export type EstimateCard = {
  type: 'estimate'
  min: number
  max: number
  currency?: string
  notice?: string
}

export type LeadSavedCard = {
  type: 'lead_saved'
  reference?: string
}

export type HandoffField = 'name' | 'email' | 'company' | 'message'

export type HandoffCard = {
  type: 'handoff'
  fields?: HandoffField[]
}

import type { BookingProposalCard } from '@/lib/phase4-contract'

export type ChatCard = EstimateCard | LeadSavedCard | HandoffCard | BookingProposalCard

export type ChatEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'message'; text: string }
  | { type: 'card'; card: unknown }
  | { type: 'done' }
  | { type: 'error'; code?: string }

export type ChatResponse = {
  message?: string
  events?: unknown[]
  card?: unknown
}

export function parseCard(value: unknown): ChatCard | null {
  if (!value || typeof value !== 'object' || !('type' in value)) return null
  const card = value as Record<string, unknown>
  if (card.type === 'estimate' && typeof card.min === 'number' && typeof card.max === 'number') {
    return { type: 'estimate', min: card.min, max: card.max, currency: typeof card.currency === 'string' ? card.currency : undefined, notice: typeof card.notice === 'string' ? card.notice : undefined }
  }
  if (card.type === 'lead_saved') return { type: 'lead_saved', reference: typeof card.reference === 'string' ? card.reference : undefined }
  if (card.type === 'handoff') {
    const fields = Array.isArray(card.fields) ? card.fields.filter((field): field is HandoffField => ['name', 'email', 'company', 'message'].includes(String(field))) : undefined
    return { type: 'handoff', fields }
  }
  if (card.type === 'booking_proposal' && card.proposal && typeof card.proposal === 'object') {
    const proposal = card.proposal as Record<string, unknown>
    if (typeof proposal.id === 'string' && typeof proposal.startsAt === 'string' && typeof proposal.endsAt === 'string' && typeof proposal.timeZone === 'string' && typeof proposal.durationMinutes === 'number' && typeof proposal.proposalReference === 'string' && typeof proposal.expiresAt === 'string') {
      return { type: 'booking_proposal', proposal: { id: proposal.id, startsAt: proposal.startsAt, endsAt: proposal.endsAt, timeZone: proposal.timeZone, durationMinutes: proposal.durationMinutes, proposalReference: proposal.proposalReference, expiresAt: proposal.expiresAt } }
    }
  }
  return null
}

export function parseChatEvent(value: unknown): ChatEvent | null {
  if (!value || typeof value !== 'object' || !('type' in value)) return null
  const event = value as Record<string, unknown>
  if ((event.type === 'text_delta' || event.type === 'message') && typeof event.text === 'string') return { type: event.type, text: event.text }
  if (event.type === 'card') return { type: 'card', card: event.card }
  if (event.type === 'done') return { type: 'done' }
  if (event.type === 'error') return { type: 'error', code: typeof event.code === 'string' ? event.code : undefined }
  return null
}
