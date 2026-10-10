import Link from 'next/link'

export function PortalUnavailable({ title = 'Client portal unavailable', message = 'The authenticated portal data contract is not connected in this environment.' }: { title?: string; message?: string }) {
  return <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6" role="alert"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-amber-900">{message}</p><Link href="/" className="mt-5 inline-flex rounded-full border border-amber-700/30 px-4 py-2 text-sm font-semibold text-amber-900">Return to site</Link></section>
}
