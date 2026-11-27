"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChartNoAxesCombined, Eye, Zap } from "lucide-react";
import { FormattedNumber } from "@/components/ui/formatted-number";
import type { PackReward, StockSymbol } from "@/lib/market-rips/client";
import packImage from "@/public/images/polar-cyan-pack.png";
import type { PackOption } from "./pack-catalog";

export type PackQuantity = 1 | 3;
export type RipState = "sealed" | "ripping" | "revealed";

interface PackStageProps {
  pack: PackOption;
  ripState: RipState;
  rewards: PackReward[];
}

const cardStyles: Record<
  StockSymbol,
  { icon: typeof Eye; className: string }
> = {
  TSLA: { icon: Zap, className: "stock-card-tsla" },
  NVDA: { icon: Eye, className: "stock-card-nvda" },
  GME: { icon: ChartNoAxesCombined, className: "stock-card-gme" },
};

function PackMark({ pack }: { pack: PackOption }) {
  return (
    <div className="pack-product-mark" aria-hidden="true">
      <strong>MARKET RIPS</strong>
      <span>{pack.mark}</span>
      <small>{pack.detail}</small>
    </div>
  );
}

export function PackStage({ pack, ripState, rewards }: PackStageProps) {
  return (
    <section
      className={`compact-pack-stage pack-visual ${pack.themeClass} relative isolate mx-auto flex w-full max-w-sm items-center justify-center overflow-hidden rounded-3xl border border-border`}
      aria-label={`${pack.label} pack reveal`}
    >
      <div className="pack-orbit" aria-hidden="true" />

      <AnimatePresence mode="wait">
        {ripState === "revealed" ? (
          <motion.div
            key="cards"
            className="relative z-10 flex h-56 w-72 items-center justify-center"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
          >
            {rewards.map((card, index) => {
              const style = cardStyles[card.symbol];
              const Icon = style.icon;
              return (
              <motion.div
                key={`${card.symbol}-${index}`}
                className={`reveal-card ${style.className} absolute flex h-44 w-28 flex-col items-center justify-center rounded-2xl border border-primary/25 bg-card shadow-lg`}
                initial={{ opacity: 0, y: 18, rotate: 0 }}
                animate={{
                  opacity: 1,
                  y: index === 1 ? -8 : 8,
                  x: (index - 1) * 76,
                  rotate: (index - 1) * 9,
                }}
                transition={{ type: "spring", stiffness: 320, damping: 26, delay: index * 0.06 }}
              >
                <span className="stock-card-icon grid size-11 place-items-center rounded-full">
                  <Icon className="size-5" strokeWidth={2.2} aria-hidden="true" />
                </span>
                <span className="mt-4 font-mono text-base font-bold tracking-wide">{card.symbol}</span>
                <span className="mt-1 flex items-baseline gap-1 text-[0.6rem] font-bold tracking-wide opacity-60">
                  <FormattedNumber value={card.amount} type="token_amount" context="compact" />
                  <span>token</span>
                </span>
              </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="pack"
            className={`relative z-10 flex h-full items-center justify-center ${ripState === "ripping" ? "pack-ripping" : ""}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          >
            <div className="pack-shell relative h-4/5">
              {ripState === "ripping" ? (
                <>
                  <div className="pack-fragment pack-fragment-top" aria-hidden="true">
                    <Image src={packImage} alt="" draggable={false} className="pack-themed-art h-full w-auto max-w-none" sizes="240px" />
                  </div>
                  <div className="pack-fragment pack-fragment-bottom" aria-hidden="true">
                    <Image src={packImage} alt="" draggable={false} className="pack-themed-art h-full w-auto max-w-none" sizes="240px" />
                  </div>
                  <span className="pack-tear-flash" aria-hidden="true" />
                </>
              ) : (
                <Image
                  src={packImage}
                  alt={`One sealed ${pack.label} stock-card pack`}
                  draggable={false}
                  className="hero-pack pack-themed-art h-full w-auto"
                  sizes="(max-width: 640px) 240px, 280px"
                  priority
                />
              )}
              <PackMark pack={pack} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
