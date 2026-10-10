import { Estimator } from '@/components/public/estimator'
import { PageIntro } from '@/components/public/page-intro'

export default function PricingPage() {
  return <><PageIntro eyebrow="Pricing" title="A clear starting point." description="Every engagement is shaped around the problem. Use the estimator to understand the kinds of investment involved, then talk to us about the details." /><section className="mx-auto grid max-w-7xl gap-16 px-6 py-20 lg:grid-cols-2 lg:px-10 lg:py-32"><div><h2 className="text-3xl font-bold">Good work starts with good context.</h2><p className="mt-5 max-w-lg leading-8 text-muted">We scope projects around outcomes, constraints, and the right delivery pace. The estimate is designed to make an early conversation easier.</p></div><Estimator /></section></>
}
