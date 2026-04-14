"use client";

import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";

type ScrollRevealProps = {
  children: ReactNode;
  direction?: "up" | "left" | "right";
  delay?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Wraps children in a container that fades in when scrolled into view.
 * Uses IntersectionObserver for performance.
 */
export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  className = "",
  style,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Add visible class after optional delay
          setTimeout(() => {
            el.classList.add("scroll-reveal-visible");
          }, delay);
          observer.unobserve(el);
        }
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -60px 0px",
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [delay]);

  const directionClass =
    direction === "left"
      ? "scroll-reveal-left"
      : direction === "right"
        ? "scroll-reveal-right"
        : "scroll-reveal";

  return (
    <div
      ref={ref}
      className={`${directionClass} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
