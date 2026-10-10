import type { ReactNode } from 'react'

export function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <section className="border-b border-border"><div className="mx-auto max-w-7xl px-6 pb-20 pt-28 lg:px-10 lg:pb-32 lg:pt-40"><p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{eyebrow}</p><h1 className="mt-7 max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-7xl">{title}</h1><p className="mt-8 max-w-2xl text-lg leading-8 text-muted">{description}</p>{children}</div></section>
}
