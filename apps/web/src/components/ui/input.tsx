import type { InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn('h-12 w-full rounded-lg border border-border bg-transparent px-4 text-sm outline-none transition placeholder:text-muted focus:border-primary', className)} {...props} />
})
