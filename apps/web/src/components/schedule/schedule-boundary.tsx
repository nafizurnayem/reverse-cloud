import { Link } from '@/i18n/navigation'
import type { BookingProposal, ScheduleSlot } from '@/lib/phase4-contract'

export function ScheduleBoundary({ slots, loading = false, error }: { slots: ScheduleSlot[]; loading?: boolean; error?: string }) {
  if (loading) return <p className="rounded-xl border border-border p-6 text-sm text-muted">Loading available times…</p>
  if (error) return <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-700">{error}</p>
  if (!slots.length) return <p className="rounded-xl border border-border p-6 text-sm text-muted">No available times were returned. Please try again later.</p>
  return <div className="grid gap-3 sm:grid-cols-2">{slots.map((slot) => <button key={slot.id} type="button" disabled className="rounded-xl border border-border p-4 text-left opacity-50"><span className="block font-semibold">{new Date(slot.startsAt).toLocaleString()}</span><span className="mt-1 block text-xs text-muted">{slot.timeZone} · {slot.durationMinutes} minutes</span></button>)}</div>
}

export function BookingProposalCard({ proposal, onConfirm, onChooseAnother, pending = false, error }: { proposal: BookingProposal; onConfirm?: () => void; onChooseAnother?: () => void; pending?: boolean; error?: string }) {
  const expired = new Date(proposal.expiresAt).getTime() <= Date.now()
  return <section className="rounded-2xl border border-border p-5"><p className="text-xs uppercase tracking-widest text-primary">Booking proposal</p><h2 className="mt-3 text-xl font-semibold">{new Date(proposal.startsAt).toLocaleString()}</h2><p className="mt-2 text-sm text-muted">{proposal.timeZone} · {proposal.durationMinutes} minutes</p>{expired && <p role="alert" className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800">This proposal has expired. Choose another time.</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={onConfirm} disabled={expired || pending} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Confirming…' : 'Confirm'}</button><button type="button" onClick={onChooseAnother} disabled={pending} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">Choose another</button></div><p className="mt-4 text-xs text-muted">A booking is confirmed only after you sign in and the server accepts this confirmation.</p></section>
}

export function LoginRequiredNotice({ returnTo }: { returnTo: string }) {
  const loginPath = `/login?returnTo=${encodeURIComponent(returnTo)}`
  return <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5"><h2 className="font-semibold">Sign in required</h2><p className="mt-2 text-sm text-amber-900">Sign in to continue. Your booking context will be preserved.</p><Link href={loginPath} className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in</Link></section>
}
