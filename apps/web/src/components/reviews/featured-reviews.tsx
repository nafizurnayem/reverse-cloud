import type { Review } from '@/lib/phase4-contract'

export function FeaturedReviews({ reviews }: { reviews: Review[] }) {
  const visible = reviews.filter((review) => review.approved && review.featured)
  if (!visible.length) return null
  return <section className="border-y border-border py-20 lg:py-28"><div className="mx-auto max-w-7xl px-6 lg:px-10"><h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Featured reviews</h2><div className="mt-10 grid gap-4 md:grid-cols-2">{visible.map((review) => <figure key={review.id} className="rounded-2xl border border-border p-6"><div className="text-primary" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}</div><blockquote className="mt-4 leading-7">{review.text}</blockquote>{review.authorName && <figcaption className="mt-5 text-sm text-muted">{review.authorName}</figcaption>}</figure>)}</div></div></section>
}
