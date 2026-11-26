"use client";

import { useEffect, useRef } from "react";

type Dot = { homeX: number; homeY: number; x: number; y: number; vx: number; vy: number };

export function HeroDotField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !stage || !context) return;

    let dots: Dot[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;
    const pointer = { x: -1000, y: -1000 };

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const gap = width < 640 ? 38 : 48;
      dots = [];
      for (let y = gap / 2; y < height; y += gap) {
        for (let x = gap / 2; x < width; x += gap) {
          dots.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0 });
        }
      }
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = stage.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const leave = () => { pointer.x = -1000; pointer.y = -1000; };

    const draw = () => {
      if (document.hidden || stage.getBoundingClientRect().bottom <= 0) {
        frame = requestAnimationFrame(draw);
        return;
      }
      context.clearRect(0, 0, width, height);
      for (const dot of dots) {
        const dx = dot.x - pointer.x;
        const dy = dot.y - pointer.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < 150) {
          const force = (1 - distance / 150) * 1.8;
          dot.vx += (dx / distance) * force;
          dot.vy += (dy / distance) * force;
        }
        dot.vx += (dot.homeX - dot.x) * 0.025;
        dot.vy += (dot.homeY - dot.y) * 0.025;
        dot.vx *= 0.88;
        dot.vy *= 0.88;
        dot.x += dot.vx;
        dot.y += dot.vy;
        const active = Math.hypot(dot.x - dot.homeX, dot.y - dot.homeY) > 2;
        context.beginPath();
        context.arc(dot.x, dot.y, active ? 2.4 : 1.5, 0, Math.PI * 2);
        context.fillStyle = active ? "rgba(230,57,70,0.58)" : "rgba(17,17,17,0.16)";
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerleave", leave);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <canvas className="studio-hero-dots" ref={canvasRef} aria-hidden="true" />;
}
