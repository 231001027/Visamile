"use client";

import { useEffect, useState, startTransition } from "react";
import { COUNTRY_VISUALS, visualForIso } from "@/lib/marketingCatalog";

const DEFAULT_ROTATION = Object.keys(COUNTRY_VISUALS);

type Props = {
  /** ISO-3 codes to cycle through (falls back to all marketing destinations) */
  countries?: string[];
  intervalMs?: number;
  /** Extra overlay on top of the country wash */
  overlayClassName?: string;
  className?: string;
};

/**
 * Full-bleed rotating destination photos + colour wash — same motion language as the home hero.
 */
export function AnimatedCountryBackdrop({
  countries = DEFAULT_ROTATION,
  intervalMs = 4200,
  overlayClassName = "bg-gradient-to-b from-black/50 via-black/40 to-black/55",
  className = "",
}: Props) {
  const list = countries.length > 0 ? countries : DEFAULT_ROTATION;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (list.length < 2) return;
    const id = window.setInterval(() => {
      startTransition(() => {
        setIndex((i) => (i + 1) % list.length);
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [list, intervalMs]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {list.map((iso, i) => {
        const v = visualForIso(iso);
        const active = i === index;
        return (
          <div
            key={iso}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${
              active ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.image}
              alt=""
              className={`h-full w-full object-cover transition-transform duration-[8000ms] ease-out ${
                active ? "scale-110" : "scale-100"
              }`}
            />
            <div
              className="absolute inset-0 opacity-45"
              style={{ background: v.gradient }}
            />
            <div className={`absolute inset-0 ${overlayClassName}`} />
          </div>
        );
      })}
    </div>
  );
}
