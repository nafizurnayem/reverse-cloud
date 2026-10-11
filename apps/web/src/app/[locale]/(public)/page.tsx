import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { FeaturedReviews } from '@/components/reviews/featured-reviews'
import type { Review } from '@/lib/phase4-contract'

export default function HomePage() {
  const t = useTranslations()
  const services = t.raw('services.items') as Array<{ title: string; text?: string }>
  const reviews: Review[] = []

  return (
    <div>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-24 lg:px-10 lg:pb-28 lg:pt-36">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{t('hero.eyebrow')}</p>
          <h1 className="mt-7 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">{t('hero.title')}</h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-muted">{t('hero.description')}</p>
          <Link href="/services" className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:gap-3">
            {t('hero.primary')} <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{t('home.introLabel')}</p>
        <div className="mt-7 grid gap-8 lg:grid-cols-2">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{t('home.introTitle')}</h2>
          <p className="max-w-lg self-end text-lg leading-8 text-muted">{t('home.introText')}</p>
        </div>
      </section>
      <section className="border-y border-border py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{t('home.capabilitiesTitle')}</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Link key={service.title} href="/services" className="group rounded-xl border border-border p-6 transition hover:border-primary">
                <h3 className="text-xl font-semibold">{service.title}</h3>
                {service.text && <p className="mt-3 leading-7 text-muted">{service.text}</p>}
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  {t('hero.primary')} <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <FeaturedReviews reviews={reviews} />
    </div>
  )
}
