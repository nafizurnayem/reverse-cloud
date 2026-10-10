import { CircleCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function SystemHealthIndicator() {
  const t = useTranslations('health')
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <CircleCheck size={14} className="text-primary" />
      {t('operational')}
    </span>
  )
}
