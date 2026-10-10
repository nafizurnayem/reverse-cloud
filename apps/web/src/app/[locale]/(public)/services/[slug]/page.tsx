import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { PageIntro } from '@/components/public/page-intro'
import { localized, services } from '@/lib/public-content'

export function generateStaticParams() {
  return services.flatMap((service) => ['en', 'bn'].map((locale) => ({ locale, slug: service.slug })))
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const service = services.find((item) => item.slug === slug)
  if (!service) notFound()
  return <><PageIntro eyebrow={locale === 'bn' ? 'সেবা' : 'Service'} title={localized(service.title, locale)} description={localized(service.summary, locale)} /><section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28"><div className="max-w-2xl rounded-2xl border border-border p-8"><p className="text-sm text-primary">{locale === 'bn' ? 'প্লেসহোল্ডার বিষয়বস্তু' : 'Placeholder content'}</p><p className="mt-5 text-lg leading-8 text-muted">{localized(service.detail, locale)}</p><Link href="/contact" className="mt-8 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{locale === 'bn' ? 'যোগাযোগ করুন' : 'Start a conversation'}</Link></div></section></>
}
