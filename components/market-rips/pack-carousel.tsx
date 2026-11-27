"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { PACK_OPTIONS, type PackId } from "./pack-catalog";

interface PackCarouselProps {
  disabled?: boolean;
  onSelect: (packId: PackId) => void;
  selectedPackId: PackId;
}

export function PackCarousel({
  disabled = false,
  onSelect,
  selectedPackId,
}: PackCarouselProps) {
  const reduceMotion = useReducedMotion();
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

          return (
            <button
              key={pack.id}
              type="button"
              ref={(node) => {
                if (node) choiceRefs.current.set(pack.id, node);
                else choiceRefs.current.delete(pack.id);
              }}
              aria-pressed={selected}
              aria-label={`Select ${pack.label} pack`}
              disabled={disabled}
              onClick={() => onSelect(pack.id)}
              className={`pack-choice ${pack.themeClass} ${selected ? "is-selected" : ""}`}
            >
              <span className="pack-choice-art" aria-hidden="true">
                <span className="pack-choice-symbol">{pack.mark}</span>
              </span>
              <span className="pack-choice-label">{pack.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
