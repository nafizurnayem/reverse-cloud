import { notFound } from 'next/navigation'
import { PageIntro } from '@/components/public/page-intro'
import { localized, portfolio } from '@/lib/public-content'

export function generateStaticParams() {
  return portfolio.flatMap((item) => ['en', 'bn'].map((locale) => ({ locale, slug: item.slug })))
}

export default async function CaseStudyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const item = portfolio.find((entry) => entry.slug === slug)
  if (!item) notFound()
  return <><PageIntro eyebrow={locale === 'bn' ? 'কেস স্টাডি টেমপ্লেট' : 'Case study template'} title={localized(item.title, locale)} description={localized(item.summary, locale)} /><section className="mx-auto max-w-3xl px-6 py-20 lg:py-28"><div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-800">{locale === 'bn' ? 'ক্লায়েন্টের লিখিত সম্মতি এবং অনুমোদিত ফলাফল না পাওয়া পর্যন্ত এই পৃষ্ঠাটি প্রকাশযোগ্য নয়।' : 'This page must remain unpublished until written client consent and approved outcomes are available.'}</div></section></>
}
