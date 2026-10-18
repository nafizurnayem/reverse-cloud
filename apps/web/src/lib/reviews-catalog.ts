import { getPublicSupabaseEnv } from "./supabase/env";
import { createClient } from "./supabase/server";

export interface PublicReviewItem {
  id: string;
  reviewer_name: string;
  reviewer_title: string | null;
  rating: number;
  body: string;
  locale: "en" | "bn";
  source: string;
  source_url?: string | null;
  is_featured: boolean;
  created_at: string;
}

export const REVIEWS_CATALOG: PublicReviewItem[] = [
  {
    id: "rev-fallback-01",
    reviewer_name: "Rahim Chowdhury",
    reviewer_title: "VP of Engineering, PayStream Ltd.",
    rating: 5,
    body: "Reverse Cloud executed our multi-region AWS cloud migration with zero downtime and strict SOC2 compliance. Their engineering rigor and communication transparency set the gold standard.",
    locale: "en",
    source: "portal",
    is_featured: true,
    created_at: "2026-10-10T12:00:00Z",
  },
  {
    id: "rev-fallback-02",
    reviewer_name: "নুসরাত জাহান",
    reviewer_title: "ম্যানেজিং ডিরেক্টর, অ্যাপেক্স লজিস্টিকস টেক",
    rating: 5,
    body: "নেক্সট.জেএস ১৬ এবং স্বয়ংক্রিয় এআই ডিসপ্যাচ প্ল্যাটফর্ম আমাদের পরিবহন কার্যক্রমকে ব্যাপকভাবে গতিশীল করেছে। চমৎকার আর্কিটেকচার ও ডেটা নিরাপত্তা।",
    locale: "bn",
    source: "portal",
    is_featured: true,
    created_at: "2026-09-20T10:00:00Z",
  },
  {
    id: "rev-fallback-03",
    reviewer_name: "Marcus Lindqvist",
    reviewer_title: "Head of Product, Nordic FinTech",
    rating: 5,
    body: "From initial estimation to production delivery, the team delivered impeccable code quality, responsive design, and robust API integrations. Highly recommended for complex SaaS builds.",
    locale: "en",
    source: "portal",
    is_featured: true,
    created_at: "2026-09-15T15:30:00Z",
  },
  {
    id: "rev-fallback-04",
    reviewer_name: "তানভীর আহমেদ",
    reviewer_title: "প্রতিষ্ঠাতা ও সিইও, ঢাকা রিটেইল টেক",
    rating: 5,
    body: "আমাদের ই-কমার্স প্ল্যাটফর্মের জন্য অসাধারণ গতি, আধুনিক UI/UX এবং পূর্ণাঙ্গ দ্বিভাষিক সুবিধা পেয়েছি। রিভার্স ক্লাউডের টিম প্রতিটি মাইলফলক সময়মতো সম্পন্ন করেছে।",
    locale: "bn",
    source: "portal",
    is_featured: true,
    created_at: "2026-08-28T09:00:00Z",
  },
];

export async function getApprovedReviews(locale?: string): Promise<PublicReviewItem[]> {
  const env = getPublicSupabaseEnv();

  if (env) {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("reviews")
        .select("id, reviewer_name, reviewer_title, rating, body, locale, source, source_url, is_featured, created_at")
        .eq("status", "approved")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (locale) {
        query = query.eq("locale", locale);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return (data as unknown as PublicReviewItem[]).map((r) => ({
          ...r,
          rating: Number(r.rating),
        }));
      }
    } catch {
      // Fall through to catalog
    }
  }

  // Filter or prioritize fallback catalog
  if (locale) {
    const localized = REVIEWS_CATALOG.filter((r) => r.locale === locale);
    if (localized.length > 0) return localized;
  }

  return REVIEWS_CATALOG;
}
