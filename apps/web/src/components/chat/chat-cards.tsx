'use client'

import { CheckCircle2 } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ChatCard, HandoffCard } from './chat-contract'
import { BookingProposalCard } from '@/components/schedule/schedule-boundary'

type Props = { card: ChatCard; onStatus: (message: string) => void }

export function ChatCardRenderer({ card, onStatus }: Props) {
  if (card.type === 'estimate') {
    return <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3"><p className="text-xs text-muted">Planning range</p><p className="mt-1 text-xl font-bold">{card.currency ?? 'USD'} {card.min.toLocaleString()}–{card.max.toLocaleString()}</p><p className="mt-1 text-xs text-muted">{card.notice ?? 'Estimate, not a quote.'}</p></div>
  }
  if (card.type === 'lead_saved') {
    return <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={15} className="text-primary" />Lead saved</div>{card.reference && <p className="mt-1 text-muted">Reference: {card.reference}</p>}</div>
  }
  if (card.type === 'booking_proposal') {
    return <BookingProposalCard proposal={card.proposal} onConfirm={() => onStatus('Sign in before confirming this booking proposal.')} onChooseAnother={() => onStatus('Choose another slot from the scheduling service.')} />
  }
  return <HandoffForm card={card} onStatus={onStatus} />
}

function HandoffForm({ card, onStatus }: { card: HandoffCard; onStatus: (message: string) => void }) {
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const fields = card.fields ?? ['name', 'email', 'company', 'message']

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!consent || loading) return
    setLoading(true)
    try {
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) })
      if (response.ok) onStatus('Your handoff request was sent.')
      else if (response.status === 429) onStatus('Too many requests. Please try again later.')
      else onStatus('The handoff service is not available yet.')
    } catch {
      onStatus('We could not send the handoff request. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-border p-3"><p className="text-xs font-semibold">Human handoff</p>{fields.map((field) => field === 'message' ? <textarea key={field} name={field} required placeholder="Message" aria-label="Message" className="min-h-20 w-full rounded-lg border border-border bg-transparent p-3 text-xs outline-none focus-visible:border-primary" /> : <Input key={field} name={field} required={field === 'name' || field === 'email'} type={field === 'email' ? 'email' : 'text'} placeholder={field[0].toUpperCase() + field.slice(1)} aria-label={field} className="h-10 text-xs" />)}<label className="flex gap-2 text-xs text-muted"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I consent to sharing these details for a team follow-up.</label><Button type="submit" disabled={!consent || loading} className="w-full py-2 text-xs">{loading ? 'Sending…' : 'Request handoff'}</Button></form>
}
