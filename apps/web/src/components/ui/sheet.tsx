'use client'

import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm" role="dialog" aria-modal="true"><div className={cn('absolute right-0 top-0 h-full w-full max-w-sm border-l border-border bg-background p-6 shadow-2xl')}><button aria-label="Close menu" onClick={onClose} className="absolute right-6 top-6 text-muted hover:text-foreground"><X size={20} /></button>{children}</div></div>
}
