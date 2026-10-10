import { PageIntro } from '@/components/public/page-intro'
import { ScheduleBoundary } from '@/components/schedule/schedule-boundary'

export default function SchedulePage() {
  return <><PageIntro eyebrow="Schedule" title="Choose a time when availability is connected." description="Available times and time zones will be supplied by the approved scheduling integration. This page does not invent slots." /><section className="mx-auto max-w-3xl px-6 py-20 lg:py-28"><div className="rounded-2xl border border-border p-6"><p className="text-sm text-muted">Signed-in account prefill and Cal.com/manual availability are not connected in this environment.</p><div className="mt-6"><ScheduleBoundary slots={[]} /></div></div></section></>
}
