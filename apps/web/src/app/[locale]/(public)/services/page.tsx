import { ArrowRight } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { PageIntro } from '@/components/public/page-intro'
import { localized, services } from '@/lib/public-content'

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <>
      <PageIntro
        eyebrow={locale === 'bn' ? 'আমরা যা করি' : 'What we do'}
        title={locale === 'bn' ? 'আপনার পরবর্তী অধ্যায়ের জন্য সরঞ্জাম।' : 'Tools for your next chapter.'}
        description={
          locale === 'bn'
            ? 'অনুমোদিত বিষয়বস্তু প্রকাশ না হওয়া পর্যন্ত নিচের বিবরণগুলো প্লেসহোল্ডার।'
            : 'The entries below are placeholders until approved service content is available.'
        }
      />
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <Link
              key={service.slug}
              href={`/services/${service.slug}`}
              locale={locale}
              className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-7 transition duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <div>
                <span className="font-mono text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="mt-8 text-2xl font-semibold tracking-tight">
                  {localized(service.title, locale)}
                </h2>
                <p className="mt-4 leading-7 text-muted">
                  {localized(service.summary, locale)}
                </p>
              </div>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                {locale === 'bn' ? 'বিস্তারিত দেখুন' : 'View details'}
                <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}

