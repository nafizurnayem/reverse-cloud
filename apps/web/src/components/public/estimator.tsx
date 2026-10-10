'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type EstimateRange = { min: number; max: number; currency?: string }
type EstimateState = { status: 'idle' | 'loading' | 'unavailable' | 'error' | 'success'; range?: EstimateRange; message?: string }

export function Estimator() {
  const [projectType, setProjectType] = useState('')
  const [timeline, setTimeline] = useState('')
  const [state, setState] = useState<EstimateState>({ status: 'idle' })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!projectType || !timeline) return
    setState({ status: 'loading' })
    try {
      const response = await fetch('/api/estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectType, timeline }) })
      const payload = await response.json() as { range?: EstimateRange; error?: string }
      if (response.status === 501) setState({ status: 'unavailable', message: payload.error ?? 'Estimates are not available yet.' })
      else if (!response.ok || !payload.range) setState({ status: 'error', message: payload.error ?? 'We could not return an estimate.' })
      else setState({ status: 'success', range: payload.range })
    } catch {
      setState({ status: 'error', message: 'The estimate service is unavailable. Please try again later.' })
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">Project estimator</h2>
      <p className="mt-2 text-sm text-muted">Any result is an estimate for planning, not a quote.</p>
      <div className="mt-8 space-y-5">
        <label className="block text-sm font-medium">Project type
          <Input value={projectType} onChange={(event) => setProjectType(event.target.value)} placeholder="Describe the project type" required className="mt-2" />
        </label>
        <label className="block text-sm font-medium">Timeline
          <select value={timeline} onChange={(event) => setTimeline(event.target.value)} required className="mt-2 h-12 w-full rounded-lg border border-border bg-background px-4 text-sm focus-visible:outline-none">
            <option value="">Select a timeline</option><option value="exploring">Exploring options</option><option value="quarter">This quarter</option><option value="soon">As soon as possible</option>
          </select>
        </label>
      </div>
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700">{state.message}</p>}
      {state.status === 'unavailable' && <p role="status" className="mt-5 rounded-lg border border-border bg-card p-3 text-sm text-muted">{state.message}</p>}
      {state.status === 'success' && state.range && <div role="status" className="mt-6 rounded-xl border border-primary/40 bg-primary/10 p-5"><p className="text-sm text-muted">Planning range</p><p className="mt-2 text-3xl font-bold">{state.range.currency ?? 'USD'} {state.range.min.toLocaleString()}–{state.range.max.toLocaleString()}</p><p className="mt-2 text-xs text-muted">Estimate only; final scope and quote require a conversation.</p></div>}
      <Button type="submit" disabled={state.status === 'loading'} className="mt-7 w-full">{state.status === 'loading' ? 'Checking availability…' : 'Get planning range'}</Button>
    </form>
  )
}
