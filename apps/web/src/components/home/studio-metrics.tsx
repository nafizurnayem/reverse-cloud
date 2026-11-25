"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";

const metrics = [
  { value: 335, prefix: "", unit: "", decimals: 0, en: "Products Launched", bn: "চালু করা পণ্য" },
  { value: 17, prefix: "", unit: "M", decimals: 1, en: "Users Have Used Our Platforms", bn: "প্ল্যাটফর্ম ব্যবহারকারী" },
  { value: 8, prefix: "", unit: "", decimals: 0, roll: true, en: "Years in Business", bn: "বছরের অভিজ্ঞতা" },
  { value: 1, prefix: "$", unit: "B", decimals: 2, en: "Raised by Our Clients", bn: "ক্লায়েন্টদের সংগৃহীত অর্থ" },
];

const countDuration = 2800;

export function StudioMetrics({ locale, fullMotion }: { locale: string; fullMotion: boolean }) {
  const grid = useRef<HTMLDListElement>(null);
  const isBn = locale === "bn";

  useLayoutEffect(() => {
    const node = grid.current;
    if (!node) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const numbers = node.querySelectorAll<HTMLElement>("[data-metric-value]");
    let frame = 0;
    let started = false;

    function draw(progress: number) {
      const eased = progress ** 2 * (3 - 2 * progress);
      numbers.forEach((number, index) => {
        const { value, prefix, unit, decimals } = metrics[index];
        if (number.hasAttribute("data-metric-wheel")) {
          number.style.setProperty("--metric-roll-progress", String(eased));
          return;
        }
        const scale = 10 ** decimals;
        const count = Math.floor(value * eased * scale) / scale;
        const display = `${prefix}${count}${unit && count > 0 ? unit : ""}`;
        if (number.textContent !== display) number.textContent = display;
      });
      const plusOpacity = Math.max(0, (progress - 0.88) / 0.12);
      node?.style.setProperty("--metric-plus-opacity", plusOpacity.toFixed(3));
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      started = true;
      observer.disconnect();
      const start = performance.now();

      const animate = (time: number) => {
        const progress = Math.min(1, (time - start) / countDuration);
        draw(progress);
        if (progress < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    }, { threshold: 0.2 });

    function syncMotion() {
      if (!fullMotion && reducedMotion.matches) {
        observer.disconnect();
        cancelAnimationFrame(frame);
        draw(1);
      } else if (!started && node) {
        draw(0);
        observer.observe(node);
      }
    }

    syncMotion();
    reducedMotion.addEventListener("change", syncMotion);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      reducedMotion.removeEventListener("change", syncMotion);
    };
  }, [fullMotion]);

  return (
    <dl className="studio-metrics" ref={grid}>
      {metrics.map(({ value, prefix, unit, roll, en, bn }) => {
        const total = `${prefix}${value}${unit}`;
        return (
          <div className="studio-metric" key={en}>
            <dt>{isBn ? bn : en}</dt>
            <dd>
              <span className="sr-only">{total}+</span>
              <span aria-hidden="true">
                {roll ? (
                  <span className="studio-metric-wheel">
                    <span data-metric-value data-metric-wheel style={{ "--metric-wheel-steps": value } as CSSProperties}>
                      {Array.from({ length: value + 1 }, (_, digit) => <span key={digit}>{digit}</span>)}
                    </span>
                  </span>
                ) : (
                  <span data-metric-value>{total}</span>
                )}
                <em>+</em>
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
