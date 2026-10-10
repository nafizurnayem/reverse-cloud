import type { ReactNode } from 'react'

export function NavigationMenu({ children }: { children: ReactNode }) {
  return <nav aria-label="Primary navigation">{children}</nav>
}
