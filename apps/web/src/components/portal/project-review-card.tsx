"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  MessageSquareQuote,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import type { PortalReview } from "@/lib/portal/types";
import { submitProjectReview } from "@/lib/portal/portal-review-action";

interface ProjectReviewCardProps {
  projectId: string;
  locale: string;
  clientName?: string;
  companyName?: string;
  existingReview?: PortalReview | null;
}

export function ProjectReviewCard({
  projectId,
  locale,
  clientName = "",
  companyName = "",
  existingReview = null,
}: ProjectReviewCardProps) {
  const isBn = locale === "bn";
  const [review, setReview] = useState<PortalReview | null>(existingReview);
  const [isEditing, setIsEditing] = useState<boolean>(!existingReview);
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [name, setName] = useState<string>(existingReview?.reviewerName ?? clientName);
  const [title, setTitle] = useState<string>(
    existingReview?.reviewerTitle ?? (companyName ? `Client at ${companyName}` : "")
  );
  const [body, setBody] = useState<string>(existingReview?.body ?? "");
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const ratingDescriptions: Record<number, { en: string; bn: string }> = {
    5: { en: "5 - Outstanding Experience", bn: "৫ - অসাধারণ অভিজ্ঞতা" },
    4: { en: "4 - Very Good", bn: "৪ - খুব ভালো" },
    3: { en: "3 - Satisfactory", bn: "৩ - সন্তোষজনক" },
    2: { en: "2 - Needs Improvement", bn: "২ - আরও উন্নতি প্রয়োজন" },
    1: { en: "1 - Unsatisfactory", bn: "১ - অসন্তোষজনক" },
  };

  const activeRatingLabel =
    ratingDescriptions[hoverRating || rating]?.[isBn ? "bn" : "en"] ?? "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedbackMessage(null);

    if (rating < 1 || rating > 5) {
      setFeedbackMessage({
        type: "error",
        text: isBn
          ? "অনুগ্রহ করে ১ থেকে ৫ এর মধ্যে একটি রেটিং নির্বাচন করুন।"
          : "Please select a rating between 1 and 5 stars.",
      });
      return;
    }

    if (!name.trim()) {
      setFeedbackMessage({
        type: "error",
        text: isBn
          ? "অনুগ্রহ করে আপনার নাম প্রদান করুন।"
          : "Please enter your name.",
      });
      return;
    }

    if (body.trim().length < 5) {
      setFeedbackMessage({
        type: "error",
        text: isBn
          ? "মতামত কমপক্ষে ৫ অক্ষরের হতে হবে।"
          : "Review body must be at least 5 characters long.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("rating", rating.toString());
    formData.append("reviewerName", name.trim());
    formData.append("reviewerTitle", title.trim());
    formData.append("body", body.trim());
    formData.append("locale", locale);

    startTransition(async () => {
      try {
        const res = await submitProjectReview(formData);
        if (res.success) {
          const updated: PortalReview = {
            id: res.reviewId || review?.id || "temp-id",
            projectId,
            reviewerName: name.trim(),
            reviewerTitle: title.trim() || null,
            rating,
            body: body.trim(),
            locale: locale === "bn" ? "bn" : "en",
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          setReview(updated);
          setIsEditing(false);
          setFeedbackMessage({
            type: "success",
            text: isBn
              ? "আপনার রিভিউ সফলভাবে জমা হয়েছে! আমাদের টিমের পর্যালোচনার পর এটি প্রকাশিত হবে।"
              : "Your review has been submitted successfully! It will be published after team review.",
          });
        } else {
          setFeedbackMessage({
            type: "error",
            text: isBn
              ? "রিভিউ জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
              : res.error || "Failed to submit review. Please try again.",
          });
        }
      } catch {
        setFeedbackMessage({
          type: "error",
          text: isBn
            ? "একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : "An unexpected error occurred. Please try again.",
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-sm transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>{isBn ? "ক্লায়েন্ট মতামত ও মূল্যায়ন" : "Client Feedback & Review"}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {isBn ? "প্রজেক্ট রিভিউ" : "Project Experience Review"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            {isBn
              ? "রিভার্স ক্লাউডের সাথে আপনার কাজের অভিজ্ঞতা শেয়ার করুন। ভেরিফায়েড রিভিউ মডারেশনের পর ওয়েবসাইটে প্রদর্শিত হয়।"
              : "Share your experience working with Reverse Cloud on this project. Verified testimonials are showcased after moderation."}
          </p>
        </div>

        {review && !isEditing && (
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setFeedbackMessage(null);
            }}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted hover:text-primary transition-colors shadow-sm"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>{isBn ? "রিভিউ পরিবর্তন করুন" : "Update Review"}</span>
          </button>
        )}
      </div>

      {/* Inline Feedback Banner */}
      {feedbackMessage && (
        <div
          role="alert"
          className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-xs font-medium ${
            feedbackMessage.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {feedbackMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <p>{feedbackMessage.text}</p>
        </div>
      )}

      {/* VIEW STATE: Display Existing Submitted Review */}
      {review && !isEditing ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 rounded-xl p-4 border">
            <div>
              <div className="flex items-center gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= review.rating
                        ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
                <span className="ml-2 text-xs font-bold text-foreground">
                  {ratingDescriptions[review.rating]?.[isBn ? "bn" : "en"]}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{review.reviewerName}</span>
                {review.reviewerTitle && <span> • {review.reviewerTitle}</span>}
              </div>
            </div>

            {/* Moderation Status Badge */}
            <div>
              {review.status === "approved" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isBn ? "অনুমোদিত ও প্রকাশিত" : "Approved & Published"}</span>
                </span>
              ) : review.status === "rejected" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{isBn ? "পুনর্বিবেচনা প্রয়োজন" : "Needs Revision"}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5 animate-pulse" />
                  <span>{isBn ? "মডারেশনের জন্য অপেক্ষমাণ" : "Pending Moderation"}</span>
                </span>
              )}
            </div>
          </div>

          <div className="relative rounded-xl border bg-muted/10 p-5 pl-6 border-l-4 border-l-primary">
            <MessageSquareQuote className="absolute top-4 right-4 h-6 w-6 text-muted-foreground/20" />
            <p className="text-sm text-foreground/90 leading-relaxed italic whitespace-pre-wrap">
              &ldquo;{review.body}&rdquo;
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {review.status === "pending"
              ? (isBn
                  ? "আপনার মতামতটি আমাদের টিমের পর্যালোচনা শেষে হোমপেজের টেস্টিমোনিয়াল সেকশনে প্রদর্শিত হতে পারে।"
                  : "Your review will appear in our verified testimonials section once approved by moderators.")
              : (isBn
                  ? "আপনার মূল্যবান মতামতের জন্য ধন্যবাদ!"
                  : "Thank you for your valuable partnership and feedback!")}
          </p>
        </div>
      ) : (
        /* FORM STATE: Submit or Edit Review */
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star Rating Interactive Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground">
              {isBn ? "সার্বিক রেটিং নির্বাচন করুন *" : "Overall Rating *"}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1.5 bg-muted/40 p-2 rounded-xl border"
                role="radiogroup"
                aria-label={isBn ? "রেটিং নির্বাচন করুন" : "Select rating"}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= (hoverRating || rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      aria-label={`${star} ${isBn ? "স্টার" : "stars"}`}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:scale-110 active:scale-95"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${
                          isFilled
                            ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                            : "text-muted-foreground/30 hover:text-amber-300"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-xs font-semibold text-primary ml-1">
                {activeRatingLabel}
              </span>
            </div>
          </div>

          {/* Name & Title Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="reviewerName" className="block text-xs font-bold text-foreground">
                {isBn ? "আপনার পূর্ণ নাম *" : "Your Full Name *"}
              </label>
              <input
                id="reviewerName"
                name="reviewerName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isBn ? "যেমন: আব্দুর রহিম" : "e.g. John Doe"}
                className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reviewerTitle" className="block text-xs font-bold text-foreground">
                {isBn ? "পদবি ও প্রতিষ্ঠান (ঐচ্ছিক)" : "Role & Organization (Optional)"}
              </label>
              <input
                id="reviewerTitle"
                name="reviewerTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isBn ? "যেমন: হেড অব ইঞ্জিনিয়ারিং, পেস্ট্রিম" : "e.g. CTO, PayStream Ltd."}
                className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Feedback Textarea */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="reviewBody" className="block text-xs font-bold text-foreground">
                {isBn ? "আপনার কাজের অভিজ্ঞতা ও মতামত *" : "Your Detailed Feedback *"}
              </label>
              <span className="text-[10px] text-muted-foreground">
                {body.length} / 5000
              </span>
            </div>
            <textarea
              id="reviewBody"
              name="body"
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                isBn
                  ? "আমাদের কাজের গতি, প্রযুক্তিগত দক্ষতা, যোগাযোগ এবং সার্বিক ডেলিভারি মান সম্পর্কে আপনার মূল্যবান মতামত লিখুন..."
                  : "Tell us about our technical execution, code quality, communication transparency, and overall satisfaction..."
              }
              className="w-full rounded-xl border bg-background p-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {review && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFeedbackMessage(null);
                  setName(review.reviewerName);
                  setTitle(review.reviewerTitle ?? "");
                  setRating(review.rating);
                  setBody(review.body);
                }}
                disabled={isPending}
                className="rounded-xl border bg-background px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>
            )}

            <button
              type="submit"
              disabled={isPending || !name.trim() || body.trim().length < 5}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{isBn ? "জমা হচ্ছে..." : "Submitting..."}</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>{isBn ? "রিভিউ জমা দিন" : "Submit Review"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
