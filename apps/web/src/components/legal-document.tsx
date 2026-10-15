import { Link } from "@/i18n/navigation";

export type LegalCopy = {
  eyebrow: string; title: string; intro: string; effective: string; lastUpdated: string;
  sections: Record<string, { title: string; body: string }>;
};

export function LegalDocument({ copy }: { copy: LegalCopy }) {
  return <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
    <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">{copy.eyebrow}</p>
    <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{copy.title}</h1>
    <p className="mt-5 text-lg leading-8 text-muted-foreground">{copy.intro}</p>
    <dl className="mt-8 grid gap-2 rounded-2xl border bg-card p-5 text-sm sm:grid-cols-2">
      <div><dt className="font-semibold">{copy.effective}</dt><dd className="text-muted-foreground">15 October 2026</dd></div>
      <div><dt className="font-semibold">{copy.lastUpdated}</dt><dd className="text-muted-foreground">15 October 2026</dd></div>
    </dl>
    <div className="mt-12 space-y-10">{Object.entries(copy.sections).map(([key, section]) =>
      <section key={key} aria-labelledby={`legal-${key}`}><h2 id={`legal-${key}`} className="text-2xl font-bold">{section.title}</h2>
        <p className="mt-3 whitespace-pre-line leading-7 text-muted-foreground">{section.body}</p></section>)}</div>
    <p className="mt-12 rounded-xl border bg-muted/40 p-5 text-sm"><Link href="/contact" className="font-semibold text-primary hover:underline">Contact Reverse Cloud</Link></p>
  </article>;
}
