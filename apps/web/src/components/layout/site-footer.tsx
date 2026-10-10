'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { siteConfig } from '@/lib/site-config'
import { SystemHealthIndicator } from './system-health-indicator'

export function SiteFooter() {
  const t = useTranslations('footer')
  const nav = useTranslations('nav')
  const locale = useLocale()
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.5fr_1fr_1fr] lg:px-10">
        <div>
          <Link href="/" locale={locale} className="text-lg font-extrabold tracking-tight">reverse<span className="text-primary">.</span>cloud</Link>
          <p className="mt-5 max-w-xs text-sm leading-7 text-muted">{t('tagline')}</p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{t('company')}</h2>
          <div className="mt-5 flex flex-col gap-3 text-sm text-muted">
            {siteConfig.navigation.map((item) => <Link key={item.key} href={item.href} locale={locale} className="rounded-sm hover:text-foreground">{nav(item.key)}</Link>)}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{t('legal')}</h2>
          <div className="mt-5 flex flex-col gap-3 text-sm text-muted">
            {siteConfig.legal.map((item) => <Link key={item.key} href={item.href} locale={locale} className="rounded-sm hover:text-foreground">{item.key === 'privacy' ? 'Privacy policy' : 'Terms'}</Link>)}
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <span>{t('copyright')}</span>
          <SystemHealthIndicator />
        </div>
      </div>
    </footer>
  )
}
