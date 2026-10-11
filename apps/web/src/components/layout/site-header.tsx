'use client'

import { Menu, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import { siteConfig } from '@/lib/site-config'
import { cn } from '@/lib/utils'
import { LocaleSwitcher } from './locale-switcher'
import { ThemeToggle } from './theme-toggle'

export function SiteHeader() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link href="/" locale={locale} className="rounded-sm text-lg font-extrabold tracking-tight">
          reverse<span className="text-primary">.</span>cloud
        </Link>
        <nav aria-label="Primary navigation" className="hidden items-center gap-7 md:flex">
          {siteConfig.navigation.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.key}
                href={item.href}
                locale={locale}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-sm text-sm transition',
                  active
                    ? 'font-medium text-foreground'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {t(item.key)}
              </Link>
            )
          })}
          <div className="ml-2 flex items-center gap-3 border-l border-border pl-6">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </nav>
        <button
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border/70 text-foreground transition hover:border-primary md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-border bg-background/95 px-6 py-6 backdrop-blur md:hidden">
          <div className="flex flex-col gap-2">
            {siteConfig.navigation.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  locale={locale}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[44px] items-center rounded-lg px-3.5 py-2.5 text-base transition',
                    active ? 'bg-primary/10 font-semibold text-primary' : 'text-muted hover:bg-card hover:text-foreground'
                  )}
                >
                  {t(item.key)}
                </Link>
              )
            })}
            <div className="mt-2 flex items-center gap-3 border-t border-border pt-5">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
