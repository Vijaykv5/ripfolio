"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { FormattedNumber } from "@/components/ui/formatted-number";
import { usePrefersReducedMotion } from "@/components/ui/use-prefers-reduced-motion";

const MIX_HOLDINGS = [
  { name: "Nvidia", percentage: 33.33, className: "mix-ratio-nvda" },
  { name: "GameStop", percentage: 33.33, className: "mix-ratio-gme" },
  { name: "Tesla", percentage: 33.34, className: "mix-ratio-tsla" },
] as const;

const CONTENT_TRANSITION = {
  duration: 0.12,
} as const;

interface MarketMixBreakdownProps {
  open: boolean;
  onToggle: () => void;
}

export function MarketMixBreakdown({
  open,
  onToggle,
}: MarketMixBreakdownProps) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="mix-breakdown min-h-11 w-full rounded-2xl px-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.span
            key="composition"
            className="block w-full"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={reduceMotion ? { duration: 0 } : CONTENT_TRANSITION}
          >
            <span className="flex items-center justify-between gap-2 text-xs font-bold">
              {MIX_HOLDINGS.map((holding) => (
                <span key={holding.name} className="flex items-baseline gap-1">
                  <span>{holding.name}</span>
                  <FormattedNumber
                    value={holding.percentage}
                    type="percent"
                    context="compact"
                    className="text-muted-foreground"
                  />
                </span>
              ))}
            </span>
            <span className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full" aria-hidden="true">
              {MIX_HOLDINGS.map((holding) => (
                <span
                  key={holding.name}
                  className={`mix-ratio-segment ${holding.className}`}
                />
              ))}
            </span>
          </motion.span>
        ) : (
          <motion.span
            key="trigger"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : CONTENT_TRANSITION}
          >
            Starting Market Mix
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
