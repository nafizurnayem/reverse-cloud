import { PortalUnavailable } from '@/components/portal/portal-boundary'
import { ProjectDetail } from '@/components/portal/project-detail'
import type { PortalProject } from '@/lib/portal-contract'

export default function PortalProjectPage() {
  const project: PortalProject | null = null
  return <main className="min-h-screen bg-background px-6 py-16 lg:px-10"><div className="mx-auto max-w-7xl">{project ? <ProjectDetail project={project} /> : <PortalUnavailable title="Project details unavailable" message="The secure, authenticated project-detail response is not connected. No project data or invoice URL is fabricated in this UI." />}</div></main>
}
