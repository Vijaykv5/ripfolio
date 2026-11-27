"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { FormattedNumber } from "@/components/ui/formatted-number";
import { usePrefersReducedMotion } from "@/components/ui/use-prefers-reduced-motion";
import { AboutRipfolioModal } from "./about-ripfolio-modal";
import { AppHeader } from "./app-header";
import { MarketMixBreakdown } from "./market-mix-breakdown";
import { DEFAULT_PACK, PACK_OPTIONS, type PackId } from "./pack-catalog";
import { PackCarousel } from "./pack-carousel";
import { PackRevealOverlay } from "./pack-reveal-overlay";
import { PackStage } from "./pack-stage";
import { PACK_STATUS_COPY, usePackRip } from "./use-pack-rip";

/* ─────────────────────────────────────────────────────────
 * PAGE CONTENT STORYBOARD
 *
 * Static controls and rip action are visible immediately.
 *
 *    0ms   shell and controls are ready
 *   80ms   value settles into place
 *  180ms   pack rises into view
 *
 * Gesture: drag left → next pack · drag right → previous pack
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  value: 80,
  pack: 180,
} as const;

const SPRING = {
  type: "spring" as const,
  stiffness: 350,
  damping: 30,
};

const SWIPE = {
  distance: 52,
  velocity: 520,
  elastic: 0.14,
} as const;

export function MarketRipsHome() {
  const reduceMotion = usePrefersReducedMotion();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const {
    error,
    errorKind,
    flowStatus,
    lastSignature,
    rewards,
    retryAllowed,
    reset,
    ripPack,
    ripState,
  } = usePackRip();
  const [stage, setStage] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mixBreakdownOpen, setMixBreakdownOpen] = useState(false);
  const [revealDismissed, setRevealDismissed] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<PackId>(DEFAULT_PACK.id);

  const selectedPack =
    PACK_OPTIONS.find((pack) => pack.id === selectedPackId) ?? DEFAULT_PACK;

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage(1), TIMING.value),
      window.setTimeout(() => setStage(2), TIMING.pack),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  function handleRip() {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    setRevealDismissed(false);
    void ripPack();
  }

  function handleSelectPack(packId: PackId) {
    if (packId === selectedPackId) return;
    if (flowStatus === "complete") reset();
    setMixBreakdownOpen(false);
    setSelectedPackId(packId);
  }

  function handlePackSwipe(offsetX: number, velocityX: number) {
    const selectedIndex = PACK_OPTIONS.findIndex(
      (pack) => pack.id === selectedPackId,
    );
    const movesNext = offsetX < -SWIPE.distance || velocityX < -SWIPE.velocity;
    const movesPrevious =
      offsetX > SWIPE.distance || velocityX > SWIPE.velocity;

    if (movesNext && selectedIndex < PACK_OPTIONS.length - 1) {
      handleSelectPack(PACK_OPTIONS[selectedIndex + 1].id);
    } else if (movesPrevious && selectedIndex > 0) {
      handleSelectPack(PACK_OPTIONS[selectedIndex - 1].id);
    }
  }

  const busy = !["idle", "complete", "error"].includes(flowStatus);
  const revealOpen =
    flowStatus === "complete" && rewards.length > 0 && !revealDismissed;
  const canChoosePack = flowStatus === "idle" || flowStatus === "complete";
  const statusCopy =
    flowStatus === "idle"
      ? `${selectedPack.priceUsdc} mock USDC · Devnet`
      : PACK_STATUS_COPY[flowStatus];
  const buttonLabel = !connected
    ? "Connect wallet"
    : flowStatus === "complete"
      ? "Rip another pack"
      : flowStatus === "error"
        ? retryAllowed
          ? errorKind === "rejected"
            ? "Continue rip"
            : "Try again"
          : "Pack pending"
        : busy
          ? flowStatus === "signing"
            ? "Approve pack"
            : PACK_STATUS_COPY[flowStatus]
          : "Rip one pack";

  return (
    <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-background p-3 text-foreground sm:p-6">
      <div className="relative flex h-full w-full max-w-lg flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-background shadow-sm">
        <AppHeader
          helpOpen={helpOpen}
          onOpenHelp={() => setHelpOpen(true)}
        />

        <div className="flex w-full flex-col items-center justify-center px-4 pb-2 pt-18">
          <motion.div
            className="page-reveal text-center"
            initial={false}
            animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : -10 }}
            transition={SPRING}
          >
            <p className="text-sm font-semibold text-muted-foreground">{selectedPack.label}</p>
            <FormattedNumber
              value={selectedPack.priceUsdc}
              type="stable_value"
              context="detailed"
              className="mt-1 block text-4xl font-semibold leading-none tracking-tight sm:text-5xl"
            />
          </motion.div>

          <PackCarousel
            selectedPackId={selectedPackId}
            onSelect={handleSelectPack}
            disabled={!canChoosePack}
          />

          <motion.div
            className={`page-reveal pack-swipe-surface mt-3 w-full ${canChoosePack ? "is-draggable" : ""}`}
            initial={false}
            animate={{ opacity: stage >= 2 ? 1 : 0, y: stage >= 2 ? 0 : 14 }}
            transition={SPRING}
            drag={canChoosePack ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={reduceMotion ? 0.01 : SWIPE.elastic}
            dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
            whileDrag={reduceMotion ? undefined : { scale: 0.985 }}
            onDragEnd={(_, info) =>
              handlePackSwipe(info.offset.x, info.velocity.x)
            }
          >
            <PackStage
              key={selectedPack.id}
              pack={selectedPack}
              ripState={ripState}
              rewards={rewards}
            />
          </motion.div>

          <button
            type="button"
            onClick={handleRip}
            disabled={busy || (flowStatus === "error" && !retryAllowed)}
            aria-busy={busy}
            className="mt-4 flex min-h-14 w-full max-w-sm cursor-pointer items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-md motion-safe:transition-[transform,filter] motion-safe:duration-100 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px disabled:cursor-wait disabled:opacity-70"
          >
            {buttonLabel}
          </button>
          <div className="mt-1 min-h-11 w-full max-w-sm">
            {selectedPackId === "market" ? (
              <MarketMixBreakdown
                open={mixBreakdownOpen}
                onToggle={() => setMixBreakdownOpen((open) => !open)}
              />
            ) : null}
          </div>
          <div
            className={`mt-1 flex min-h-5 items-center justify-center gap-2 text-center text-xs font-medium ${error ? "text-destructive" : "text-muted-foreground"}`}
            role={error ? "alert" : "status"}
            aria-live="polite"
          >
            <span>{error ?? statusCopy}</span>
            {error && lastSignature ? (
              <a
                href={`https://explorer.solana.com/tx/${lastSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                View tx
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <AboutRipfolioModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />

      <AnimatePresence>
        {revealOpen ? (
          <PackRevealOverlay
            pack={selectedPack}
            rewards={rewards}
            onClose={() => setRevealDismissed(true)}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}
