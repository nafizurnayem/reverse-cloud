"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { PublicReviewItem } from "@/lib/reviews-catalog";

type CardFrame = { transform: string; opacity: string };

export function StudioReviewCarousel({ reviews, locale }: { reviews: PublicReviewItem[]; locale: string }) {
  const [position, setPosition] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const previousFrames = useRef<Map<string, CardFrame>>(new Map());
  const animations = useRef<Animation[]>([]);
  const count = reviews.length;

  const moveBy = useCallback((distance: number) => {
    if (distance === 0) return;

    const frames = new Map<string, CardFrame>();
    trackRef.current?.querySelectorAll<HTMLElement>("[data-review-slot]").forEach((card) => {
      const slot = card.dataset.reviewSlot;
      if (slot === undefined) return;
      const { transform, opacity } = getComputedStyle(card);
      frames.set(slot, { transform, opacity });
    });
    previousFrames.current = frames;
    setPosition((current) => current + distance);
  }, []);

  useLayoutEffect(() => {
    const frames = previousFrames.current;
    if (frames.size === 0) return;
    previousFrames.current = new Map();

    trackRef.current?.querySelectorAll<HTMLElement>("[data-review-slot]").forEach((card) => {
      const start = frames.get(card.dataset.reviewSlot ?? "");
      if (!start) return;

      const { transform, opacity } = getComputedStyle(card);
      if (start.opacity === "0" && opacity === "0") return;

      animations.current.push(card.animate([start, { transform, opacity }], {
        duration: 650,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      }));
    });

    return () => {
      animations.current.forEach((animation) => animation.cancel());
      animations.current = [];
    };
  }, [position]);

  useEffect(() => {
    if (count < 2) return;
    const timer = window.setTimeout(() => moveBy(1), 5000);
    return () => window.clearTimeout(timer);
  }, [count, moveBy, position]);

  if (count === 0) return null;

  const reviewIndex = (slot: number) => ((slot % count) + count) % count;
  const active = reviewIndex(position);

  // Keep cards mounted beyond both edges so they can slide through the loop.
  const radius = count === 1 ? 0 : Math.floor(count / 2) + 2;
  const slots = Array.from({ length: radius * 2 + 1 }, (_, index) => position - radius + index);

  function selectReview(index: number) {
    const forward = reviewIndex(index - active);
    const distance = forward <= count / 2 ? forward : forward - count;
    moveBy(distance);
  }

  return (
    <div className="studio-review-carousel" aria-roledescription="carousel" aria-label={locale === "bn" ? "ক্লায়েন্ট রিভিউ" : "Client reviews"}>
      <div className="studio-review-track" data-count={count} ref={trackRef}>
        {slots.map((slot) => {
          const offset = slot - position;
          const depth = Math.min(Math.abs(offset), 3);
          const review = reviews[reviewIndex(slot)];
          const initials = review.reviewer_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
          return (
            <figure
              className="studio-review-card"
              data-depth={depth}
              data-review-slot={slot}
              style={{ "--review-offset": `${offset * 105}%` } as CSSProperties}
              key={slot}
              aria-hidden={offset !== 0}
            >
              <span className="studio-review-quote" aria-hidden="true">“</span>
              <span className="studio-review-avatar" aria-hidden="true">{initials}</span>
              <blockquote>{review.body}</blockquote>
              <div className="studio-review-stars" aria-label={offset === 0 ? `${review.rating} out of 5 stars` : undefined}>{"★".repeat(review.rating)}</div>
              <figcaption>
                <strong>{review.reviewer_name}</strong>
                {review.reviewer_title && <span>{review.reviewer_title}</span>}
              </figcaption>
            </figure>
          );
        })}
      </div>
      {count > 1 && (
        <div className="studio-review-dots" role="group" aria-label={locale === "bn" ? "রিভিউ বাছুন" : "Choose a review"}>
          {reviews.map((review, index) => (
            <button key={review.id} type="button" className={index === active ? "is-active" : ""}
              onClick={() => selectReview(index)}
              aria-label={`${locale === "bn" ? "রিভিউ" : "Review"} ${index + 1}`}
              aria-current={index === active ? "true" : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
