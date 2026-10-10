import { PageIntro } from '@/components/public/page-intro'

export default function AboutPage() {
  return <><PageIntro eyebrow="About Reverse Cloud" title="Small team. Serious systems." description="We are a senior engineering partner helping ambitious teams turn complex ideas into useful, dependable products." /><section className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2 lg:px-10 lg:py-32"><h2 className="text-4xl font-bold tracking-tight">Technology should create room for better work.</h2><div className="space-y-6 text-lg leading-8 text-muted"><p>Reverse Cloud brings product thinking and engineering craft together. We work closely, communicate clearly, and build for the people who will use and maintain what we ship.</p><p>Our approach is intentionally practical: understand the outcome, choose the simplest durable path, and improve it with evidence.</p></div></section></>
}
