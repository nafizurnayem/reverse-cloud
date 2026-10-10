import { ServiceFinder } from '@/components/public/service-finder'
import { PageIntro } from '@/components/public/page-intro'

export default function FindServicePage() {
  return <><PageIntro eyebrow="Service finder" title="Not sure where to start?" description="Answer three quick questions and we will point you toward the most useful next step." /><section className="mx-auto max-w-2xl px-6 py-20 lg:py-32"><ServiceFinder /></section></>
}
