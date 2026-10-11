'use client'

import { ArrowUpRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FormEvent, useState } from 'react'

export function NewsletterForm() {
  const t = useTranslations('footer')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return <p className="text-sm text-primary">{t('subscribed')}</p>
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm border-b border-border">
      <input
        type="email"
        required
        placeholder={t('email')}
        aria-label={t('email')}
        className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted"
      />
      <button type="submit" aria-label={t('subscribe')} className="text-primary transition hover:text-foreground">
        <ArrowUpRight size={19} />
      </button>
    </form>
  )
}
