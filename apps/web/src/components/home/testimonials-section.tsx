"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Filter,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import type { PublicReviewItem } from "@/lib/reviews-catalog";
import { Badge } from "@/components/ui/badge";

interface TestimonialsSectionProps {
  reviews: PublicReviewItem[];
  locale: string;
  translations: {
    eyebrow: string;
    title: string;
    subtitle: string;
    verifiedClient: string;
    satisfactionScore: string;
    satisfactionDesc: string;
    onTimeDelivery: string;
    onTimeDesc: string;
  };
}

type ReviewCategoryFilter = "all" | "five_star" | "portal_verified";

export function TestimonialsSection({
  reviews,
  locale,
  translations,
}: TestimonialsSectionProps) {
  const isBn = locale === "bn";
  const [activeFilter, setActiveFilter] = useState<ReviewCategoryFilter>("all");

  const filteredReviews = useMemo(() => {
    if (activeFilter === "five_star") {
      return reviews.filter((r) => r.rating === 5);
    }
    if (activeFilter === "portal_verified") {
      return reviews.filter((r) => r.source === "portal");
    }
    return reviews;
  }, [reviews, activeFilter]);

  if (reviews.length === 0) return null;

  return (
    <section className="relative overflow-hidden border-t border-border/60 bg-gradient-to-b from-background via-muted/10 to-background py-20 sm:py-28">
      {/* Background glow effects */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <Badge
            variant="outline"
            className="mb-4 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3.5 py-1 text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>{translations.eyebrow}</span>
          </Badge>

          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            {translations.title}
          </h2>

          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
            {translations.subtitle}
          </p>

          {/* Social Proof Stats Banner */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-8 w-full max-w-lg border border-border/80 rounded-2xl p-4 sm:p-5 bg-card/60 backdrop-blur-sm shadow-sm">
            <div className="text-center sm:border-r border-border/60 pr-2">
              <div className="flex items-center justify-center gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className="h-3.5 w-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                  />
                ))}
              </div>
              <div className="text-sm font-bold text-foreground">
                {translations.satisfactionScore}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {translations.satisfactionDesc}
              </div>
            </div>

            <div className="text-center pl-2">
              <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 mb-1">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {isBn ? "ভেরিফায়েড" : "Verified"}
                </span>
              </div>
              <div className="text-sm font-bold text-foreground">
                {translations.onTimeDelivery}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {translations.onTimeDesc}
              </div>
            </div>
          </div>

          {/* User Feedback Improvement: Testimonials Category Filters */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 mr-1">
              <Filter className="h-3 w-3" />
              <span>{isBn ? "ফিল্টার:" : "Filter:"}</span>
            </span>

            {(
              [
                { key: "all", en: "All Testimonials", bn: "সকল মতামত" },
                { key: "five_star", en: "5-Star Rating", bn: "৫-তারকা রেটিং" },
                { key: "portal_verified", en: "Verified Clients", bn: "ভেরিফায়েড ক্লায়েন্ট" },
              ] as const
            ).map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                  }`}
                >
                  {isBn ? filter.bn : filter.en}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reviews Grid */}
        {filteredReviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center backdrop-blur-sm max-w-md mx-auto">
            <MessageSquareQuote className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-foreground">
              {isBn ? "কোনো রিভিউ পাওয়া যায়নি" : "No testimonials found"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isBn
                ? "এই ফিল্টারের সাথে মিলে এমন কোনো রিভিউ নেই।"
                : "No reviews match the selected filter criterion."}
            </p>
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className="mt-4 inline-flex items-center rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            >
              {isBn ? "সকল রিভিউ দেখুন" : "View all testimonials"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {filteredReviews.map((item) => {
              const initials = item.reviewer_name
                .split(" ")
                .map((w) => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <div
                  key={item.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                {/* Decorative quote icon */}
                <MessageSquareQuote
                  className="pointer-events-none absolute top-6 right-6 h-10 w-10 text-muted-foreground/10 transition-colors group-hover:text-primary/10"
                  aria-hidden="true"
                />

                <div className="space-y-4">
                  {/* Rating Stars & Source Badge */}
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-1"
                      aria-label={`${item.rating} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= item.rating
                              ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.35)]"
                              : "text-muted-foreground/20"
                          }`}
                        />
                      ))}
                    </div>

                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{translations.verifiedClient}</span>
                    </span>
                  </div>

                  {/* Review Testimonial Body */}
                  <p className="text-sm sm:text-base text-foreground/90 leading-relaxed italic">
                    &ldquo;{item.body}&rdquo;
                  </p>
                </div>

                {/* Reviewer Details */}
                <div className="mt-6 flex items-center gap-3.5 border-t border-border/50 pt-5">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs ring-1 ring-primary/20"
                    aria-hidden="true"
                  >
                    {initials || "RC"}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {item.reviewer_name}
                    </h3>
                    {item.reviewer_title && (
                      <p className="text-xs text-muted-foreground">
                        {item.reviewer_title}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </section>
  );
}
