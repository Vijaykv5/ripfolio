"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, WalletCards, X } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { FormattedNumber } from "@/components/ui/formatted-number";
import type { PackQuantity } from "./pack-stage";

interface PurchaseReviewProps {
  open: boolean;
  quantity: PackQuantity;
  onClose: () => void;
}

export function PurchaseReview({ open, quantity, onClose }: PurchaseReviewProps) {
  const { connected, connecting, publicKey, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [walletNotice, setWalletNotice] = useState(false);
  const price = quantity === 1 ? 10 : 27;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
      setWalletNotice(false);
    };
  }, [onClose, open]);

  function requestWallet() {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }

    window.dispatchEvent(
      new CustomEvent("market-rips:buy-pack", {
        detail: {
          intent: "prepare-purchase",
          quantity,
          price,
          wallet: publicKey.toBase58(),
        },
      }),
    );
    setWalletNotice(true);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-foreground/25 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close transaction review" />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            className="relative z-10 w-full max-w-lg rounded-t-3xl border border-border bg-card p-5 shadow-xl sm:rounded-3xl sm:p-6"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your pack</p>
                <h2 id="review-title" className="mt-2 text-3xl font-semibold tracking-tight">Ready?</h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="grid size-10 cursor-pointer place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Close"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <dl className="mt-6 divide-y divide-border rounded-2xl border border-border bg-background/50 px-4">
              <ReviewRow term="Pack" detail={`${quantity === 1 ? "Single" : "Triple"} rip · ${quantity * 3} cards`} />
              <ReviewRow term="Total" detail={<FormattedNumber value={price} type="stable_value" />} />
              <ReviewRow
                term="Wallet"
                detail={publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : "Not connected"}
              />
            </dl>

            {walletNotice ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/35 bg-primary/10 p-4" role="status">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-sm leading-5">
                  {wallet?.adapter.name} is ready.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={requestWallet}
              disabled={connecting}
              aria-busy={connecting}
              className="mt-5 flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-foreground px-5 font-bold text-background motion-safe:transition-[transform,filter] motion-safe:duration-100 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px disabled:cursor-wait disabled:opacity-70"
            >
              <WalletCards className="size-4" aria-hidden="true" />
              {connecting ? "Connecting..." : connected ? "Continue" : "Connect wallet"}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ReviewRow({ term, detail }: { term: string; detail: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right font-semibold">{detail}</dd>
    </div>
  );
}
