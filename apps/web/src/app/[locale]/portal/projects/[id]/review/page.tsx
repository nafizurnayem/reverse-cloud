import { ReviewForm } from '@/components/reviews/review-form'

export default function ProjectReviewPage() {
  return <main className="min-h-screen bg-background px-6 py-16 lg:px-10"><div className="mx-auto max-w-2xl"><ReviewForm projectId="" eligible={false} reason="Project eligibility is not available until the authenticated project contract is connected." /></div></main>
}
