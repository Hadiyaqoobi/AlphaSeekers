"use client";

import { useEffect, useState, type ReactNode } from "react";

type ScrollNavbarProps = {
  children: ReactNode;
};

/**
 * Wraps the navbar and toggles between transparent and solid states
 * based on scroll position. Transparent in hero, solid after 80px scroll.
 */
export function ScrollNavbar({ children }: ScrollNavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    // Set initial state
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`navbar-outer ${scrolled ? "navbar-solid" : "navbar-transparent"}`}
    >
      {children}
    </header>
  );
}
