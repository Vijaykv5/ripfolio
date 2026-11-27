"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { FormattedNumber } from "@/components/ui/formatted-number";
import { usePrefersReducedMotion } from "@/components/ui/use-prefers-reduced-motion";
import { PACK_OPTIONS, type PackId } from "./pack-catalog";

interface PackCarouselProps {
  disabled?: boolean;
  onSelect: (packId: PackId) => void;
  selectedPackId: PackId;
}

const PACK_LOGOS: Partial<
  Record<PackId, { height: number; src: string; width: number }>
> = {
  gme: { height: 10, src: "/stock-logos/gamestop.svg", width: 26 },
  nvda: { height: 20, src: "/stock-logos/nvidia.svg", width: 20 },
  tsla: { height: 20, src: "/stock-logos/tesla.svg", width: 20 },
};

export function PackCarousel({
  disabled = false,
  onSelect,
  selectedPackId,
}: PackCarouselProps) {
  const reduceMotion = usePrefersReducedMotion();
  const choiceRefs = useRef(new Map<PackId, HTMLButtonElement>());

  useEffect(() => {
    choiceRefs.current.get(selectedPackId)?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [reduceMotion, selectedPackId]);

  return (
    <div className="pack-picker w-full max-w-sm" aria-label="Choose a stock pack">
      <div className="pack-picker-track">
        {PACK_OPTIONS.map((pack) => {
          const selected = pack.id === selectedPackId;
          const logo = PACK_LOGOS[pack.id];

          return (
            <button
              key={pack.id}
              type="button"
              ref={(node) => {
                if (node) choiceRefs.current.set(pack.id, node);
                else choiceRefs.current.delete(pack.id);
              }}
              aria-pressed={selected}
              aria-label={`Select ${pack.label} pack for $${pack.priceUsdc}`}
              disabled={disabled}
              onClick={() => onSelect(pack.id)}
              className={`pack-choice ${pack.themeClass} ${selected ? "is-selected" : ""}`}
            >
              <span className="pack-choice-art" aria-hidden="true">
                {logo ? (
                  <Image
                    src={logo.src}
                    alt=""
                    width={logo.width}
                    height={logo.height}
                    unoptimized
                    style={{ height: logo.height, width: logo.width }}
                  />
                ) : (
                  <span className="pack-choice-symbol">{pack.mark}</span>
                )}
              </span>
              <span className="pack-choice-copy">
                <span className="pack-choice-label">{pack.label}</span>
                <FormattedNumber
                  value={pack.priceUsdc}
                  type="stable_value"
                  context="compact"
                  className="pack-choice-price"
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
