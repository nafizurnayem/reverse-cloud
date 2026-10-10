import { Link } from '@/i18n/navigation'
import type { PortalProject } from '@/lib/portal-contract'

export function ProjectList({ projects }: { projects: PortalProject[] }) {
  if (!projects.length) return <p className="rounded-xl border border-border p-6 text-sm text-muted">No projects are available for this account.</p>
  return <div className="grid gap-4 md:grid-cols-2">{projects.map((project) => <Link key={project.id} href={`/portal/projects/${project.id}`} className="rounded-2xl border border-border p-6 transition hover:border-primary"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-muted">{project.code}</p><h2 className="mt-2 text-xl font-semibold">{project.title}</h2></div><span className="rounded-full border border-border px-3 py-1 text-xs capitalize">{project.status}</span></div><div className="mt-6"><div className="flex justify-between text-xs text-muted"><span>Progress</span><span>{project.progress}%</span></div><div className="mt-2 h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} /></div></div>{project.dueDate && <p className="mt-5 text-sm text-muted">Due {project.dueDate}</p>}</Link>)}</div>
}
