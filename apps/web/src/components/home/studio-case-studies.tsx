"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Project = {
  name: string;
  image: string;
  alt: { en: string; bn: string };
  outcome: { en: string; bn: string };
};

export function StudioCaseStudies({ projects, language }: { projects: Project[]; language: "en" | "bn" }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const list = listRef.current;
    if (!list || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".studio-project").forEach((project) => {
        gsap.fromTo(project,
          { autoAlpha: 0.2, y: 72, scale: 0.975 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: project,
              start: "top 92%",
              end: "top 42%",
              scrub: 1.5,
              invalidateOnRefresh: true,
            },
          },
        );
      });
    }, list);

    return () => context.revert();
  }, []);

  return (
    <div className="studio-project-list" ref={listRef}>
      {projects.map((project, index) => (
        <article key={project.name} className="studio-project">
          <div className="studio-project-image">
            <Image src={project.image} alt={project.alt[language]} fill unoptimized sizes="(max-width: 56rem) 90vw, 58vw" priority={index === 0} />
          </div>
          <div className="studio-project-copy">
            <h3>{project.name}</h3>
            <p>{project.outcome[language]}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
