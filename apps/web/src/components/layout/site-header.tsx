'use client'

import { Menu, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { siteConfig } from '@/lib/site-config'
import { LocaleSwitcher } from './locale-switcher'
import { ThemeToggle } from './theme-toggle'

export function SiteHeader() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link href="/" locale={locale} className="rounded-sm text-lg font-extrabold tracking-tight">
          reverse<span className="text-primary">.</span>cloud
        </Link>
        <nav aria-label="Primary navigation" className="hidden items-center gap-8 md:flex">
          {siteConfig.navigation.map((item) => (
            <Link key={item.key} href={item.href} locale={locale} className="rounded-sm text-sm text-muted transition hover:text-foreground">
              {t(item.key)}
            </Link>
          ))}
          <LocaleSwitcher />
          <ThemeToggle />
        </nav>
        <button
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md md:hidden"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-border px-6 py-5 md:hidden">
          <div className="flex flex-col gap-5">
            {siteConfig.navigation.map((item) => (
              <Link key={item.key} href={item.href} locale={locale} onClick={() => setOpen(false)} className="rounded-sm text-sm text-muted">
                {t(item.key)}
              </Link>
            ))}
            <div className="flex items-center gap-3 pt-2">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
