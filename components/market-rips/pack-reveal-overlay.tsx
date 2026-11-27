"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChartNoAxesCombined, Check, Eye, Zap } from "lucide-react";
import { FormattedNumber } from "@/components/ui/formatted-number";
import { usePrefersReducedMotion } from "@/components/ui/use-prefers-reduced-motion";
import type { PackReward, StockSymbol } from "@/lib/market-rips/client";
import packImage from "@/public/images/polar-cyan-pack.png";
import type { PackOption } from "./pack-catalog";

interface PackRevealOverlayProps {
  onClose: () => void;
  pack: PackOption;
  rewards: PackReward[];
}

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Confirmed pack reveal
 *
 *    0ms   confirmed backdrop appears; sealed packet settles
 *  420ms   packet pulls taut
 *  620ms   jagged seam tears; wrapper halves separate
 *  820ms   confirmed stock cards rise through the opening
 * 1180ms   cards fan out; result copy and Done action appear
 *
 * Reduced motion: confirmed cards and controls appear immediately.
 * ───────────────────────────────────────────────────────── */

const REVEAL_STAGE = {
  settled: 1,
  tension: 2,
  torn: 3,
  cards: 4,
  complete: 5,
} as const;

const TIMING = {
  settle: 80,
  tension: 420,
  tear: 620,
  cards: 820,
  complete: 1180,
} as const;

const MOTION = {
  backdrop: { enter: 0.25, exit: 0.2 },
  packet: { type: "spring" as const, stiffness: 300, damping: 30 },
  wrapper: { type: "spring" as const, stiffness: 260, damping: 25 },
  card: { type: "spring" as const, stiffness: 280, damping: 26 },
  copy: { type: "spring" as const, stiffness: 350, damping: 30 },
  cardStagger: 0.12,
} as const;

const cardIcons: Record<StockSymbol, typeof Eye> = {
  TSLA: Zap,
  NVDA: Eye,
  GME: ChartNoAxesCombined,
};

export function PackRevealOverlay({
  onClose,
  pack,
  rewards,
}: PackRevealOverlayProps) {
  const reduceMotion = usePrefersReducedMotion();
  const actionRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const initialStage = reduceMotion ? REVEAL_STAGE.complete : 0;
  const stageRef = useRef(initialStage);
  const [stage, setStage] = useState(initialStage);

  const revealComplete = stage >= REVEAL_STAGE.complete;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    actionRef.current?.focus();

    function moveToStage(nextStage: number) {
      if (nextStage <= stageRef.current) return;
      stageRef.current = nextStage;
      setStage(nextStage);
    }

    const timers = reduceMotion
      ? []
      : [
          window.setTimeout(
            () => moveToStage(REVEAL_STAGE.settled),
            TIMING.settle,
          ),
          window.setTimeout(
            () => moveToStage(REVEAL_STAGE.tension),
            TIMING.tension,
          ),
          window.setTimeout(
            () => moveToStage(REVEAL_STAGE.torn),
            TIMING.tear,
          ),
          window.setTimeout(
            () => moveToStage(REVEAL_STAGE.cards),
            TIMING.cards,
          ),
          window.setTimeout(
            () => moveToStage(REVEAL_STAGE.complete),
            TIMING.complete,
          ),
        ];

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") {
        event.preventDefault();
        actionRef.current?.focus();
      }

      if (event.key === "Escape") {
        if (stageRef.current < REVEAL_STAGE.complete) {
          moveToStage(REVEAL_STAGE.complete);
        } else {
          onCloseRef.current();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      timers.forEach(window.clearTimeout);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [reduceMotion]);

  function handleAction() {
    if (!revealComplete) {
      stageRef.current = REVEAL_STAGE.complete;
      setStage(REVEAL_STAGE.complete);
      return;
    }
    onClose();
  }

  return (
    <motion.div
      className={`pack-reveal-overlay ${pack.themeClass}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-reveal-title"
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        transition: {
          duration: reduceMotion ? 0 : MOTION.backdrop.enter,
          ease: [0.16, 1, 0.3, 1],
        },
      }}
      exit={{
        opacity: 0,
        transition: {
          duration: reduceMotion ? 0 : MOTION.backdrop.exit,
          ease: [0.4, 0, 1, 1],
        },
      }}
    >
          <button
            type="button"
            className="pack-reveal-backdrop"
            tabIndex={-1}
            onClick={handleAction}
            aria-label={revealComplete ? "Close pack reveal" : "Skip animation"}
          />

          <div className="pack-reveal-content">
            <motion.div
              className="pack-reveal-status"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : MOTION.copy}
            >
              <span className="pack-reveal-check" aria-hidden="true">
                <Check className="size-4" strokeWidth={2.5} />
              </span>
              Claim confirmed on Solana
            </motion.div>

            <div className="pack-reveal-scene" aria-live="polite">
              <div className="pack-reveal-cards" aria-hidden={!revealComplete}>
                {rewards.map((reward, index) => {
                  const Icon = cardIcons[reward.symbol];
                  const center = (rewards.length - 1) / 2;
                  const offset = index - center;

                  return (
                    <motion.article
                      key={`${reward.symbol}-${reward.entryIndex}-${index}`}
                      className="pack-reveal-card"
                      initial={false}
                      animate={{
                        opacity: stage >= REVEAL_STAGE.cards ? 1 : 0,
                        x:
                          stage >= REVEAL_STAGE.complete
                            ? offset * 96
                            : 0,
                        y:
                          stage >= REVEAL_STAGE.complete
                            ? Math.abs(offset) * 14
                            : stage >= REVEAL_STAGE.cards
                              ? -8
                              : 68,
                        rotate:
                          stage >= REVEAL_STAGE.complete ? offset * 9 : 0,
                        scale:
                          stage >= REVEAL_STAGE.complete
                            ? 1
                            : stage >= REVEAL_STAGE.cards
                              ? 0.88
                              : 0.72,
                      }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : {
                              ...MOTION.card,
                              delay:
                                stage >= REVEAL_STAGE.complete
                                  ? index * MOTION.cardStagger
                                  : 0,
                            }
                      }
                    >
                      <div className="pack-reveal-card-topline">
                        <span>RIPFOLIO</span>
                        <span>0{index + 1}</span>
                      </div>
                      <span className="pack-reveal-card-icon">
                        <Icon className="size-6" strokeWidth={2} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="pack-reveal-card-label">STOCK</p>
                        <h3>{reward.symbol}</h3>
                      </div>
                      <div className="pack-reveal-card-amount">
                        <FormattedNumber
                          value={reward.amount}
                          type="token_amount"
                          context="compact"
                        />
                        <span>token</span>
                      </div>
                    </motion.article>
                  );
                })}
              </div>

              <motion.div
                className="reveal-pack-shell"
                initial={false}
                animate={{
                  opacity: stage >= REVEAL_STAGE.complete ? 0 : 1,
                  scale:
                    stage >= REVEAL_STAGE.tension
                      ? 1.025
                      : stage >= REVEAL_STAGE.settled
                        ? 1
                        : 0.88,
                  y: stage >= REVEAL_STAGE.settled ? 0 : 22,
                }}
                transition={reduceMotion ? { duration: 0 } : MOTION.packet}
                aria-hidden="true"
              >
                <motion.div
                  className="reveal-pack-fragment reveal-pack-fragment-top"
                  animate={{
                    x: stage >= REVEAL_STAGE.torn ? -42 : 0,
                    y: stage >= REVEAL_STAGE.torn ? -94 : 0,
                    rotate: stage >= REVEAL_STAGE.torn ? -11 : 0,
                    opacity: stage >= REVEAL_STAGE.complete ? 0 : 1,
                  }}
                  transition={reduceMotion ? { duration: 0 } : MOTION.wrapper}
                >
                  <Image
                    src={packImage}
                    alt=""
                    fill
                    priority
                    draggable={false}
                    sizes="(max-width: 640px) 224px, 256px"
                    className="pack-themed-art"
                  />
                </motion.div>
                <motion.div
                  className="reveal-pack-fragment reveal-pack-fragment-bottom"
                  animate={{
                    x: stage >= REVEAL_STAGE.torn ? 38 : 0,
                    y: stage >= REVEAL_STAGE.torn ? 102 : 0,
                    rotate: stage >= REVEAL_STAGE.torn ? 9 : 0,
                    opacity: stage >= REVEAL_STAGE.complete ? 0 : 1,
                  }}
                  transition={reduceMotion ? { duration: 0 } : MOTION.wrapper}
                >
                  <Image
                    src={packImage}
                    alt=""
                    fill
                    priority
                    draggable={false}
                    sizes="(max-width: 640px) 224px, 256px"
                    className="pack-themed-art"
                  />
                </motion.div>
                <motion.span
                  className="reveal-pack-tear"
                  initial={false}
                  animate={{
                    opacity:
                      stage >= REVEAL_STAGE.torn && !revealComplete ? 1 : 0,
                    scaleX: stage >= REVEAL_STAGE.torn ? 1 : 0,
                  }}
                  transition={{ duration: reduceMotion ? 0 : 0.15 }}
                />
              </motion.div>
            </div>

            <motion.div
              className="pack-reveal-copy"
              initial={false}
              animate={{
                opacity: revealComplete ? 1 : 0,
                y: revealComplete ? 0 : 12,
              }}
              transition={reduceMotion ? { duration: 0 } : MOTION.copy}
            >
              <p className="pack-reveal-eyebrow">{pack.label} opened</p>
              <h2 id="pack-reveal-title">
                {rewards.length === 1 ? "Your stock is here." : "Your stocks are here."}
              </h2>
              <p>
                {rewards.length} {rewards.length === 1 ? "card" : "cards"}, claimed to your wallet.
              </p>
            </motion.div>
          </div>

          <button
            ref={actionRef}
            type="button"
            onClick={handleAction}
            className="pack-reveal-action"
          >
            {revealComplete ? "Done" : "Skip reveal"}
          </button>
    </motion.div>
  );
}
