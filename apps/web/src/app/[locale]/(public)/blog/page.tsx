import { Link } from '@/i18n/navigation'
import { PageIntro } from '@/components/public/page-intro'
import { blogPosts, localized } from '@/lib/public-content'

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <><PageIntro eyebrow={locale === 'bn' ? 'ইনসাইটস' : 'Insights'} title={locale === 'bn' ? 'নির্মাণের নোট।' : 'Notes from the build.'} description={locale === 'bn' ? 'অনুমোদিত প্রকাশনার আগে পোস্টগুলো প্লেসহোল্ডার হিসেবে চিহ্নিত।' : 'Posts are marked as placeholders until editorial content is approved.'} /><section className="mx-auto grid max-w-7xl gap-4 px-6 py-20 md:grid-cols-2 lg:px-10 lg:py-28">{blogPosts.map((post, index) => <article key={post.slug} className="rounded-2xl border border-border p-7"><p className="text-xs uppercase tracking-widest text-muted">0{index + 1} · {locale === 'bn' ? 'প্লেসহোল্ডার' : 'Placeholder'}</p><h2 className="mt-8 text-2xl font-semibold">{localized(post.title, locale)}</h2><p className="mt-4 leading-7 text-muted">{localized(post.summary, locale)}</p><Link href={`/blog/${post.slug}`} className="mt-8 inline-flex text-sm font-semibold text-primary">{locale === 'bn' ? 'পোস্ট পড়ুন' : 'Read post'} →</Link></article>)}</section></>
}
