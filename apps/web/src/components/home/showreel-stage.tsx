"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, CalendarDays, Pause, Play, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { HeroDotField } from "./hero-dot-field";

const poster = "/images/stitch/showreel-frame.jpg";

export function ShowreelStage({ locale, fullMotion, reel = "/images/stitch/reverse-cloud-reel.mp4" }: { locale: string; fullMotion: boolean; reel?: string }) {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inline = useRef<HTMLVideoElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pointerLabel = useRef<HTMLSpanElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pausedByUser, setPausedByUser] = useState<boolean | null>(null);
  const isBn = locale === "bn";
  const playLabel = isBn ? "শোরিল চালান" : "Play Reel";

  useEffect(() => {
    const section = track.current;
    const viewport = stage.current;
    if (!section || !viewport) return;

    gsap.registerPlugin(ScrollTrigger);
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const geometry = { progress: 0 };
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${section.offsetHeight - viewport.offsetHeight}`,
          scrub: 1.2,
        },
      });

      // CSS keeps the stage pinned during the 60–85 hold, then scrolls it offscreen.
      timeline
        .to(geometry, {
          progress: 1,
          duration: 60,
          ease: "none",
          onUpdate: () => {
            viewport.style.setProperty("--reel-progress", geometry.progress.toFixed(4));
            viewport.toggleAttribute("data-reel-expanded", geometry.progress > 0.26);
          },
        })
        .to({}, { duration: 25 });

      return () => {
        viewport.style.removeProperty("--reel-progress");
        viewport.removeAttribute("data-reel-expanded");
      };
    });

    return () => motion.revert();
  }, [fullMotion]);

  useEffect(() => {
    const video = inline.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;

    function syncPlayback() {
      if (!video) return;
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      const paused = pausedByUser ?? (reducedMotion.matches || saveData === true);
      if (visible && !document.hidden && !dialog.current?.open && !paused) {
        video.muted = true;
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    });
    observer.observe(video);
    reducedMotion.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      video.pause();
    };
  }, [fullMotion, pausedByUser]);

  function moveLabel(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse" || !pointerLabel.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(bounds.width - 124, Math.max(8, event.clientX - bounds.left + 18));
    const y = Math.min(bounds.height - 48, Math.max(8, event.clientY - bounds.top + 18));
    pointerLabel.current.style.setProperty("--pointer-x", `${x}px`);
    pointerLabel.current.style.setProperty("--pointer-y", `${y}px`);
  }


  function openReel() {
    const modal = dialog.current;
    const video = player.current;
    if (!modal || !video) return;
    modal.showModal();
    inline.current?.pause();
    video.currentTime = inline.current?.currentTime ?? 0;
    void video.play().catch(() => {});
  }

  function finishReel() {
    player.current?.pause();
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const paused = pausedByUser ?? (window.matchMedia("(prefers-reduced-motion: reduce)").matches || saveData === true);
    if (!paused && !document.hidden) {
      void inline.current?.play().catch(() => {});
    }
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <section
      className="studio-hero"
      data-reel-motion={fullMotion ? "full" : undefined}
      ref={track}
      aria-labelledby="studio-heading"
    >
      <div className="studio-stage" ref={stage}>
        <HeroDotField />
        <div className="studio-hero-copy">
          <h1 id="studio-heading">
            {isBn ? <>নির্মাণের বাইরেও ভাবে<br />এমন একটি AI পণ্য দল</> : <>An AI Product Team<br />That Thinks Beyond The Build</>}
            <span>{isBn ? "।" : "."}</span>
          </h1>
          <p>{isBn ? "পণ্যের কৌশল, ডিজাইন ও প্রকৌশল। ধারণা থেকে লঞ্চ পর্যন্ত।" : "Product strategy, design, and engineering. From first idea to launch."}</p>
          <div className="studio-hero-actions">
            <Link href="/services" className="studio-hero-cta studio-hero-cta-primary">Explore Services<ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/schedule" className="studio-hero-cta studio-hero-cta-secondary"><CalendarDays size={15} aria-hidden="true" />Book a Discovery Call</Link>
          </div>
        </div>

        <div className="studio-reel">
          <video
            ref={inline}
            className="studio-reel-video"
            src={reel}
            poster={poster}
            muted
            loop
            playsInline
            preload="none"
            onPlaying={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            aria-hidden="true"
          />
          <button
            ref={trigger}
            type="button"
            className="studio-reel-trigger"
            aria-label={playLabel}
            aria-haspopup="dialog"
            onClick={openReel}
            onPointerEnter={moveLabel}
            onPointerMove={moveLabel}
          >
            <span className="studio-play studio-play-default"><Play size={14} fill="currentColor" />{playLabel}</span>
            <span className="studio-play studio-play-pointer" ref={pointerLabel} aria-hidden="true"><Play size={14} fill="currentColor" />{playLabel}</span>
          </button>
          <button
            type="button"
            className="studio-reel-pause"
            onClick={() => setPausedByUser(isPlaying)}
            aria-label={isPlaying
              ? isBn ? "শোরিলের চলাচল থামান" : "Pause inline reel"
              : isBn ? "শোরিলের চলাচল শুরু করুন" : "Play inline reel"}
          >
            {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
        </div>

      </div>

      <dialog className="studio-reel-dialog" ref={dialog} aria-label={playLabel} onClose={finishReel}>
        <button
          type="button"
          className="studio-dialog-close"
          aria-label={isBn ? "বন্ধ করুন" : "Close reel"}
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          <X size={24} aria-hidden="true" />
        </button>
        <video ref={player} src={reel} poster={poster} controls playsInline preload="none" aria-label={playLabel} />
      </dialog>
    </section>
  );
}
