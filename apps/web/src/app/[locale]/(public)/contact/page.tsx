import { ContactForm } from '@/components/public/contact-form'
import { PageIntro } from '@/components/public/page-intro'

export default function ContactPage() {
  return <><PageIntro eyebrow="Start a project" title="Have a hard problem?" description="Tell us where you are headed. We will help you find a clear next step." /><section className="mx-auto grid max-w-7xl gap-16 px-6 py-20 lg:grid-cols-[0.75fr_1.25fr] lg:px-10 lg:py-32"><div><h2 className="text-2xl font-semibold">Let’s make progress.</h2><p className="mt-4 leading-7 text-muted">Share a little context and we will respond with useful questions, not a sales script.</p><p className="mt-10 text-sm text-muted">hello@reverse.cloud</p></div><ContactForm /></section></>
}
