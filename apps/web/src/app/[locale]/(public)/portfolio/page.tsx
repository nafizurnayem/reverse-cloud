import { Link } from '@/i18n/navigation'
import { PageIntro } from '@/components/public/page-intro'
import { localized, portfolio } from '@/lib/public-content'

export default async function PortfolioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <><PageIntro eyebrow={locale === 'bn' ? 'নির্বাচিত কাজ' : 'Selected work'} title={locale === 'bn' ? 'অনুমোদিত কেস স্টাডি আসছে।' : 'Approved work will appear here.'} description={locale === 'bn' ? 'ক্লায়েন্টের সম্মতি ছাড়া কোনো পোর্টফোলিও আইটেম প্রকাশ করা হয় না।' : 'No portfolio item is published without recorded client consent.'} /><section className="mx-auto grid max-w-7xl gap-4 px-6 py-20 lg:grid-cols-2 lg:px-10 lg:py-28">{portfolio.map((project) => <article key={project.slug} className="rounded-2xl border border-border p-8"><p className="text-sm text-amber-700">{locale === 'bn' ? 'প্রকাশের অপেক্ষায়' : 'Pending consent'}</p><h2 className="mt-6 text-2xl font-semibold">{localized(project.title, locale)}</h2><p className="mt-4 leading-7 text-muted">{localized(project.summary, locale)}</p><Link href={`/case-studies/${project.slug}`} className="mt-8 inline-flex text-sm font-semibold text-primary">{locale === 'bn' ? 'কেস স্টাডি টেমপ্লেট' : 'Case study template'} →</Link></article>)}</section></>
}
