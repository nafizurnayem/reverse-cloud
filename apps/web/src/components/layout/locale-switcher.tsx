'use client'

import { Languages } from 'lucide-react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const nextLocale = locale === 'en' ? 'bn' : 'en'

  return (
    <button
      type="button"
      aria-label={`Switch to ${nextLocale === 'bn' ? 'Bangla' : 'English'}`}
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted transition hover:border-primary hover:text-primary"
    >
      <Languages size={15} />
      {nextLocale}
    </button>
  )
}
