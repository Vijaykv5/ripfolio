"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, ShieldCheck, Sparkles, WalletCards, X } from "lucide-react";
import Image from "next/image";
import { FormattedNumber } from "@/components/ui/formatted-number";
import { usePrefersReducedMotion } from "@/components/ui/use-prefers-reduced-motion";
import { PROGRAM_ID } from "@/lib/market-rips/client";

interface AboutRipfolioModalProps {
  onClose: () => void;
  open: boolean;
}

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Compact Ripfolio details
 *
 *    0ms   blurred backdrop appears; sheet rises from bottom
 *  250ms   sheet settles and is fully interactive
 *
 * Exit:
 *    0ms   sheet drops; backdrop clears
 * ───────────────────────────────────────────────────────── */

const MODAL_MOTION = {
  backdropIn: 0.25,
  backdropOut: 0.2,
  panel: { type: "spring" as const, visualDuration: 0.25, bounce: 0.1 },
} as const;

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

const STOCKS = [
  {
    height: 18,
    label: "Tesla",
    src: "/stock-logos/tesla.svg",
    symbol: "TSLA",
    width: 18,
  },
  {
    height: 18,
    label: "NVIDIA",
    src: "/stock-logos/nvidia.svg",
    symbol: "NVDA",
    width: 18,
  },
  {
    height: 10,
    label: "GameStop",
    src: "/stock-logos/gamestop.svg",
    symbol: "GME",
    width: 28,
  },
] as const;

const COMPACT_HELP_CSS = `
.compact-help-shell{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:color-mix(in oklch,var(--foreground) 18%,transparent);backdrop-filter:blur(14px) saturate(.94)}
.compact-help-backdrop{position:absolute;inset:0;border:0;background:transparent;cursor:default}
.compact-help-panel{position:relative;z-index:1;width:min(320px,calc(100vw - 32px));max-height:min(400px,calc(100dvh - 64px));overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--border);border-radius:20px;background:var(--card);box-shadow:0 18px 48px color-mix(in oklch,var(--foreground) 16%,transparent);color:var(--foreground);scrollbar-width:thin}
.compact-help-header{position:sticky;top:0;z-index:2;display:flex;min-height:48px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--card);padding:4px 8px 4px 12px}
.compact-help-header h2{font-size:14px;font-weight:700;line-height:1.2;letter-spacing:-.015em}
.compact-help-close{display:grid;width:40px;height:40px;flex:0 0 auto;place-items:center;border:0;border-radius:999px;background:var(--card);color:var(--muted-foreground);cursor:pointer;transition:background-color .1s cubic-bezier(0,0,.2,1),color .1s cubic-bezier(0,0,.2,1),transform .1s cubic-bezier(0,0,.2,1)}
.compact-help-body{display:flex;flex-direction:column;gap:8px;padding:8px 10px max(10px,env(safe-area-inset-bottom))}
.compact-help-intro{display:grid;min-height:52px;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:8px;border:1px solid var(--border);border-radius:12px;background:var(--card);padding:6px 8px}
.compact-help-brand{display:grid;width:36px;height:36px;place-items:center;border-radius:10px;background:var(--primary);color:var(--primary-foreground);font-size:13px;font-weight:800}
.compact-help-intro div{min-width:0}.compact-help-intro strong{display:block;font-size:12px;font-weight:700}.compact-help-intro p{margin-top:2px;overflow:hidden;color:var(--muted-foreground);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}
.compact-help-network{display:inline-flex;align-items:center;gap:4px;color:var(--muted-foreground);font-size:10px;font-weight:700}.compact-help-network:before{width:6px;height:6px;border-radius:999px;background:var(--primary);content:""}
.compact-help-prices{display:grid;grid-template-columns:1fr 1fr;overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--card)}
.compact-help-price{display:flex;min-width:0;min-height:48px;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px}.compact-help-price+.compact-help-price{border-left:1px solid var(--border)}
.compact-help-price span:first-child{overflow:hidden;color:var(--muted-foreground);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}.compact-help-price span:last-child{flex:0 0 auto;color:var(--foreground);font-size:12px;font-weight:700}
.compact-help-section-title{margin-bottom:6px;font-size:11px;font-weight:700}
.compact-help-stocks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.compact-help-stock{display:grid;min-width:0;min-height:48px;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:4px;border:1px solid var(--border);border-radius:12px;background:var(--card);padding:5px}
.compact-help-stock-logo{display:grid;width:28px;height:28px;place-items:center}.compact-help-stock img{display:block;object-fit:contain}.compact-help-stock strong{display:block;overflow:hidden;font-size:10.5px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.compact-help-stock small{display:block;overflow:hidden;color:var(--muted-foreground);font-size:9px;text-overflow:ellipsis;white-space:nowrap}
.compact-help-flow{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:8px;border:1px solid var(--border);border-radius:12px;background:color-mix(in oklch,var(--primary) 4%,var(--card));padding:7px 8px}
.compact-help-flow-icon{display:grid;width:32px;height:32px;place-items:center;border-radius:10px;background:color-mix(in oklch,var(--primary) 10%,var(--card));color:var(--primary)}
.compact-help-flow strong{display:block;font-size:11px;font-weight:700}.compact-help-flow p{margin-top:2px;color:var(--muted-foreground);font-size:10px;line-height:1.35}
.compact-help-note{display:flex;align-items:flex-start;gap:6px;color:var(--muted-foreground);font-size:9.5px;line-height:1.35}.compact-help-note svg{margin-top:1px;flex:0 0 auto;color:var(--primary)}
.compact-help-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.compact-help-actions a,.compact-help-actions button{display:inline-flex;min-height:40px;align-items:center;justify-content:center;gap:5px;border:1px solid var(--border);border-radius:999px;background:var(--card);color:var(--foreground);font-family:var(--font-sora),Arial,sans-serif;font-size:11px;font-weight:700;text-decoration:none;cursor:pointer}.compact-help-actions button{border-color:var(--primary);background:var(--primary);color:var(--primary-foreground)}
.compact-help-close:focus-visible,.compact-help-actions a:focus-visible,.compact-help-actions button:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.compact-help-close:active,.compact-help-actions a:active,.compact-help-actions button:active{transform:translateY(1px)}
@media(hover:hover){.compact-help-close:hover{background:var(--secondary);color:var(--foreground)}.compact-help-actions a:hover{border-color:color-mix(in oklch,var(--primary) 48%,var(--border))}.compact-help-actions button:hover{filter:brightness(1.04)}}
`;

export function AboutRipfolioModal({
  onClose,
  open,
}: AboutRipfolioModalProps) {
  const reduceMotion = usePrefersReducedMotion();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href]",
        ),
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <>
      <style data-ripfolio-help>{COMPACT_HELP_CSS}</style>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="compact-help-shell"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: {
                duration: reduceMotion ? 0 : MODAL_MOTION.backdropIn,
                ease: [0.16, 1, 0.3, 1],
              },
            }}
            exit={{
              opacity: 0,
              transition: {
                duration: reduceMotion ? 0 : MODAL_MOTION.backdropOut,
                ease: [0.4, 0, 1, 1],
              },
            }}
          >
            <button
              type="button"
              className="compact-help-backdrop"
              onClick={onClose}
              tabIndex={-1}
              aria-label="Close Ripfolio details"
            />

            <motion.div
              ref={panelRef}
              className="compact-help-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="about-modal-title"
              aria-describedby="about-modal-description"
              initial={reduceMotion ? false : { opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: "100%" }}
              transition={
                reduceMotion ? { duration: 0 } : MODAL_MOTION.panel
              }
            >
              <div className="compact-help-header">
                <h2 id="about-modal-title">About Ripfolio</h2>
                <button
                  ref={closeRef}
                  type="button"
                  className="compact-help-close"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="compact-help-body">
                <div className="compact-help-intro">
                  <span className="compact-help-brand" aria-hidden="true">
                    R
                  </span>
                  <div>
                    <strong>Verified stock-card packs</strong>
                    <p id="about-modal-description">
                      Three rewards, revealed on Solana.
                    </p>
                  </div>
                  <span className="compact-help-network">Devnet</span>
                </div>

                <div className="compact-help-prices" aria-label="Pack prices">
                  <div className="compact-help-price">
                    <span>Market Mix</span>
                    <FormattedNumber
                      value={10}
                      type="stable_value"
                      context="compact"
                    />
                  </div>
                  <div className="compact-help-price">
                    <span>Single stock</span>
                    <FormattedNumber
                      value={5}
                      type="stable_value"
                      context="compact"
                    />
                  </div>
                </div>

                <section aria-labelledby="possible-pulls-title">
                  <h3
                    id="possible-pulls-title"
                    className="compact-help-section-title"
                  >
                    Possible pulls
                  </h3>
                  <div className="compact-help-stocks">
                    {STOCKS.map((stock) => (
                      <div key={stock.symbol} className="compact-help-stock">
                        <span
                          className="compact-help-stock-logo"
                          aria-hidden="true"
                        >
                          <Image
                            src={stock.src}
                            alt=""
                            width={stock.width}
                            height={stock.height}
                            unoptimized
                            style={{ height: stock.height, width: stock.width }}
                          />
                        </span>
                        <span>
                          <strong>{stock.symbol}</strong>
                          <small>{stock.label}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="compact-help-flow">
                  <span className="compact-help-flow-icon" aria-hidden="true">
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <strong>Pay · draw · claim</strong>
                    <p>
                      Approve the pack, receive a verified draw, then claim the
                      mock tokens to your wallet.
                    </p>
                  </div>
                </div>

                <p className="compact-help-note">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  Test assets only—not company shares or redeemable equity.
                </p>

                <div className="compact-help-actions">
                  <a
                    href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    Explorer
                  </a>
                  <button type="button" onClick={onClose}>
                    <WalletCards className="size-3.5" aria-hidden="true" />
                    Got it
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>,
    document.body,
  );
}
