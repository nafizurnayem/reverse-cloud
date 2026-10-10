import { notFound } from 'next/navigation'
import { PageIntro } from '@/components/public/page-intro'
import { blogPosts, localized } from '@/lib/public-content'

export function generateStaticParams() {
  return blogPosts.flatMap((post) => ['en', 'bn'].map((locale) => ({ locale, slug: post.slug })))
}

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const post = blogPosts.find((entry) => entry.slug === slug)
  if (!post) notFound()
  return <><PageIntro eyebrow={locale === 'bn' ? 'প্লেসহোল্ডার পোস্ট' : 'Placeholder post'} title={localized(post.title, locale)} description={localized(post.summary, locale)} /><article className="mx-auto max-w-3xl space-y-6 px-6 py-20 text-lg leading-8 text-muted lg:py-28">{post.body.map((paragraph) => <p key={paragraph.en}>{localized(paragraph, locale)}</p>)}</article></>
}
