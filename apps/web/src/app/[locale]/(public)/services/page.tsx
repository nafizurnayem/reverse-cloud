import { Link } from '@/i18n/navigation'
import { PageIntro } from '@/components/public/page-intro'
import { localized, services } from '@/lib/public-content'

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <><PageIntro eyebrow={locale === 'bn' ? 'আমরা যা করি' : 'What we do'} title={locale === 'bn' ? 'আপনার পরবর্তী অধ্যায়ের জন্য সরঞ্জাম।' : 'Tools for your next chapter.'} description={locale === 'bn' ? 'অনুমোদিত বিষয়বস্তু প্রকাশ না হওয়া পর্যন্ত নিচের বিবরণগুলো প্লেসহোল্ডার।' : 'The entries below are placeholders until approved service content is available.'} /><section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{services.map((service, index) => <Link key={service.slug} href={`/services/${service.slug}`} locale={locale} className="group rounded-2xl border border-border p-7 transition hover:border-primary"><span className="text-sm text-primary">{String(index + 1).padStart(2, '0')}</span><h2 className="mt-12 text-2xl font-semibold">{localized(service.title, locale)}</h2><p className="mt-4 leading-7 text-muted">{localized(service.summary, locale)}</p><span className="mt-8 inline-flex text-sm font-semibold text-primary">{locale === 'bn' ? 'বিস্তারিত দেখুন' : 'View details'} →</span></Link>)}</div></section></>
}
