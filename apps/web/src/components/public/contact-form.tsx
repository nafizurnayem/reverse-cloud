'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type FormState = 'idle' | 'loading' | 'success' | 'unavailable' | 'error'

export function ContactForm() {
  const [state, setState] = useState<FormState>('idle')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setState('loading')
    try {
      const response = await fetch('/api/leads', { method: 'POST', body: JSON.stringify(Object.fromEntries(values)), headers: { 'content-type': 'application/json' } })
      const payload = await response.json() as { error?: string }
      if (response.status === 501) {
        setState('unavailable')
        setMessage(payload.error ?? 'Contact capture is not available yet.')
      } else if (!response.ok) {
        setState('error')
        setMessage(payload.error ?? 'We could not send your inquiry.')
      } else {
        setState('success')
        form.reset()
      }
    } catch {
      setState('error')
      setMessage('The contact service is unavailable. Please try again later.')
    }
  }

  if (state === 'success') return <div role="status" className="rounded-2xl border border-primary/40 bg-primary/10 p-8"><h2 className="text-2xl font-semibold">Inquiry received.</h2><p className="mt-3 text-muted">The contact integration accepted your message.</p></div>
  return <form onSubmit={submit} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><Input name="name" required placeholder="Your name" aria-label="Your name" /><Input name="email" required type="email" placeholder="Email address" aria-label="Email address" /></div><Input name="company" placeholder="Company or project" aria-label="Company or project" /><textarea name="message" required placeholder="Tell us what you are building" aria-label="Tell us what you are building" className="min-h-36 w-full rounded-lg border border-border bg-transparent p-4 text-sm outline-none focus:border-primary" /><label className="flex gap-2 text-sm text-muted"><input name="consent" value="accepted" type="checkbox" required />I consent to sharing these contact details for a response. See our privacy information.</label>{(state === 'unavailable' || state === 'error') && <p role="alert" className="rounded-lg border border-border bg-card p-3 text-sm text-muted">{message}</p>}<Button type="submit" disabled={state === 'loading'}>{state === 'loading' ? 'Sending…' : 'Send inquiry'}</Button></form>
}
