const areas = [
  ['Clients', 'Source tags supported by the contract: website, platform, referral, walk-in.'],
  ['Projects', 'Project title, code, status, assignment, and preview link fields.'],
  ['Milestones', 'Weight, progress, dates, and status supplied to the portal.'],
  ['Project updates', 'Client-visible activity boundary; staff-only updates remain private.'],
  ['Payment schedules', 'Manual schedule, amount, currency, due date, and status.'],
]

export default function AdminPage() {
  return <main className="min-h-screen bg-background px-6 py-16 lg:px-10"><div className="mx-auto max-w-7xl"><p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Staff workspace</p><h1 className="mt-5 text-4xl font-bold">Portal administration</h1><div role="alert" className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-800">Staff session, permission checks, and CRUD contracts are not available in this repository. Management controls are disabled and no changes are simulated.</div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{areas.map(([title, detail]) => <section key={title} className="rounded-2xl border border-border p-6"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-muted">{detail}</p><div className="mt-6 flex gap-3"><button type="button" disabled className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground opacity-50">Create</button><button type="button" disabled className="rounded-full border border-border px-4 py-2 text-sm font-semibold opacity-50">View list</button></div><p className="mt-4 text-xs text-muted">Loading, empty, validation, and confirmation states will bind here when the staff API is provided.</p></section>)}</div></div></main>
}
