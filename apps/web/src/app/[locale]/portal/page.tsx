import { PortalUnavailable } from '@/components/portal/portal-boundary'
import { ProjectList } from '@/components/portal/project-list'
import type { PortalProject } from '@/lib/portal-contract'

export default function PortalPage() {
  const projects: PortalProject[] = []
  return <main className="min-h-screen bg-background px-6 py-16 lg:px-10"><div className="mx-auto max-w-7xl"><p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Client portal</p><h1 className="mt-5 text-4xl font-bold">Your projects</h1><p className="mt-4 max-w-2xl text-muted">Read-only project progress, milestones, updates, and payment information.</p><div className="mt-10"><PortalUnavailable message="Authenticated user and project data contracts are not available in this repository. The read-only project list is ready to consume the server-owned response." /></div><div className="mt-8"><ProjectList projects={projects} /></div></div></main>
}
