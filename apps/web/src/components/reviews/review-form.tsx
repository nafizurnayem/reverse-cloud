'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = { projectId: string; eligible: boolean; reason?: string }

export function ReviewForm({ projectId, eligible, reason }: Props) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'submitted' | 'error' | 'unavailable'>('idle')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rating || text.trim().length < 10) return
    setState('loading')
    try {
      const response = await fetch('/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, rating, text: text.trim() }) })
      const payload = await response.json() as { error?: string }
      if (response.status === 501) {
        setState('unavailable')
        setMessage(payload.error ?? 'Review submission is not available yet.')
      } else if (!response.ok) {
        setState('error')
        setMessage(payload.error ?? 'We could not submit your review.')
      } else {
        setState('submitted')
      }
    } catch {
      setState('error')
      setMessage('The review service is unavailable. Please try again later.')
    }
  }

  if (!eligible) return <p className="rounded-xl border border-border p-5 text-sm text-muted">{reason ?? 'This project is not currently eligible for a review.'}</p>
  if (state === 'submitted') return <p role="status" className="rounded-xl border border-primary/40 bg-primary/10 p-5 text-sm">Thank you. Your review was submitted for moderation.</p>
  return <form onSubmit={submit} className="rounded-2xl border border-border p-6"><h2 className="text-xl font-semibold">Share project feedback</h2><p className="mt-2 text-sm text-muted">Reviews are moderated before they can appear publicly.</p><fieldset className="mt-6"><legend className="text-sm font-medium">Rating</legend><div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="cursor-pointer"><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} className="sr-only" /> <span className={`text-2xl ${rating >= value ? 'text-primary' : 'text-muted'}`} aria-label={`${value} out of 5`}>★</span></label>)}</div></fieldset><label className="mt-6 block text-sm font-medium">Written review<textarea value={text} onChange={(event) => setText(event.target.value)} minLength={10} required aria-describedby="review-help" className="mt-2 min-h-32 w-full rounded-lg border border-border bg-transparent p-4 text-sm outline-none focus-visible:border-primary" /></label><p id="review-help" className="mt-2 text-xs text-muted">Please enter at least 10 characters.</p>{(state === 'error' || state === 'unavailable') && <p role="alert" className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-muted">{message}</p>}<Button type="submit" disabled={state === 'loading' || !rating || text.trim().length < 10} className="mt-6">{state === 'loading' ? 'Submitting…' : 'Submit review'}</Button></form>
}
