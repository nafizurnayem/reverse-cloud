import { Link } from '@/i18n/navigation'
import { PageIntro } from '@/components/public/page-intro'
import { localized, portfolio } from '@/lib/public-content'

export default async function CaseStudiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <><PageIntro eyebrow={locale === 'bn' ? 'কেস স্টাডি' : 'Case studies'} title={locale === 'bn' ? 'অনুমোদিত কেস স্টাডি এখানে আসবে।' : 'Approved case studies will appear here.'} description={locale === 'bn' ? 'ক্লায়েন্টের সম্মতি ও অনুমোদিত ফলাফল ছাড়া কোনো ফলাফল প্রকাশ করা হয় না।' : 'No client outcome is published without client consent and approved content.'} /><section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28"><div className="grid gap-4 md:grid-cols-2">{portfolio.map((item) => <Link key={item.slug} href={`/case-studies/${item.slug}`} className="rounded-2xl border border-border p-8 transition hover:border-primary"><p className="text-sm text-amber-700">{locale === 'bn' ? 'প্রকাশের অপেক্ষায়' : 'Pending approval'}</p><h2 className="mt-6 text-2xl font-semibold">{localized(item.title, locale)}</h2><p className="mt-4 leading-7 text-muted">{localized(item.summary, locale)}</p></Link>)}</div></section></>
}
