"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey, type Connection } from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  Check,
  Copy,
  LogOut,
  RefreshCw,
  WalletCards,
  X,
} from "lucide-react";
import { FormattedNumber } from "@/components/ui/formatted-number";
import { usePrefersReducedMotion } from "@/components/ui/use-prefers-reduced-motion";
import deploymentJson from "@/deployments/devnet.json";

interface WalletAccountModalProps {
  onClose: () => void;
  open: boolean;
}

type AccountBalances = {
  sol: number;
  stocks: Array<{ amount: number; name: string; symbol: string }>;
};

type BalanceState =
  | { status: "loading" }
  | { status: "ready"; balances: AccountBalances }
  | { status: "error"; message: string };

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Wallet account modal
 *
 *    0ms   blurred backdrop appears; sheet rises from the bottom
 *   80ms   identity and balances are visible with the sheet
 *  350ms   sheet settles and is fully interactive
 *
 * Exit:
 *    0ms   panel contracts; backdrop clears
 * ───────────────────────────────────────────────────────── */

const MODAL_MOTION = {
  backdropIn: 0.25,
  backdropOut: 0.2,
  panel: { type: "spring" as const, visualDuration: 0.35, bounce: 0.14 },
} as const;

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

const ACCOUNT_MODAL_CSS = `
.compact-account-shell{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:color-mix(in oklch,var(--foreground) 18%,transparent);backdrop-filter:blur(14px) saturate(.94)}
.compact-account-backdrop{position:absolute;inset:0;border:0;background:transparent;cursor:default}
.compact-account-panel{position:relative;z-index:1;width:min(320px,calc(100vw - 32px));max-height:min(416px,calc(100dvh - 64px));overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--border);border-radius:20px;background:var(--card);box-shadow:0 18px 48px color-mix(in oklch,var(--foreground) 16%,transparent);color:var(--foreground);scrollbar-width:thin}
.compact-account-header{position:sticky;top:0;z-index:2;display:flex;min-height:48px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--card);padding:4px 8px 4px 12px}
.compact-account-header h2{font-size:14px;font-weight:700;line-height:1.2;letter-spacing:-.015em}
.compact-account-close,.compact-account-section-title button{display:grid;width:40px;height:40px;flex:0 0 auto;place-items:center;border:0;border-radius:999px;background:var(--card);color:var(--muted-foreground);cursor:pointer;transition:background-color .1s cubic-bezier(0,0,.2,1),color .1s cubic-bezier(0,0,.2,1),transform .1s cubic-bezier(0,0,.2,1)}
.compact-account-wallet{display:grid;min-height:48px;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px;margin:8px 10px 0;border:1px solid var(--border);border-radius:12px;background:var(--card);padding:4px 8px}
.compact-account-wallet-icon{display:grid;width:32px;height:32px;place-items:center;border-radius:10px;background:color-mix(in oklch,var(--primary) 9%,var(--card));color:var(--primary)}
.compact-account-wallet button{display:inline-flex;min-width:0;min-height:40px;align-items:center;gap:4px;border:0;border-radius:10px;background:transparent;color:var(--foreground);padding:0 4px;font-family:var(--font-sora),Arial,sans-serif;font-size:12px;font-weight:650;cursor:pointer}
.compact-account-network{display:inline-flex;align-items:center;gap:4px;color:var(--muted-foreground);font-size:12px;font-weight:650}
.compact-account-network>span{width:6px;height:6px;border-radius:999px;background:var(--primary)}
.compact-account-body{display:flex;flex-direction:column;gap:8px;padding:8px 10px max(10px,env(safe-area-inset-bottom))}
.compact-account-sol{overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--card)}
.compact-account-sol article{display:flex;min-height:52px;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px}
.compact-account-sol article>span{color:var(--muted-foreground);font-size:12px}
.compact-account-sol strong{display:flex;min-width:0;align-items:baseline;justify-content:flex-end;gap:4px;color:var(--foreground);font-size:15px;font-variant-numeric:tabular-nums;font-weight:700;letter-spacing:-.025em;line-height:1;text-align:right}
.compact-account-sol strong>span:last-child{color:var(--muted-foreground);font-size:12px;font-weight:650;letter-spacing:0}
.compact-account-section-title{display:flex;min-height:40px;align-items:center;justify-content:space-between;gap:8px}
.compact-account-section-title h3{font-size:12px;font-weight:700}
.compact-account-list{overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--card)}
.compact-account-row{display:grid;min-height:44px;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:6px;background:var(--card);padding:4px 8px}
.compact-account-row+.compact-account-row{border-top:1px solid var(--border)}
.compact-account-logo{display:grid;width:36px;height:32px;place-items:center}
.compact-account-logo img{display:block;object-fit:contain}
.compact-account-stock-name{display:flex;min-width:0;align-items:baseline;gap:6px}
.compact-account-stock-name strong,.compact-account-stock-name span{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}
.compact-account-stock-name strong{font-weight:700}.compact-account-stock-name span{color:var(--muted-foreground)}
.compact-account-row>p{display:flex;align-items:baseline;color:var(--foreground);font-size:12px;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}
.compact-account-row>p>span:last-child{color:var(--muted-foreground);font-weight:500}
.compact-account-actions button,.compact-account-error button{display:inline-flex;min-height:40px;align-items:center;justify-content:center;gap:6px;border:1px solid color-mix(in oklch,var(--destructive) 18%,var(--border));border-radius:999px;background:var(--card);color:var(--destructive);padding:8px 12px;font-family:var(--font-sora),Arial,sans-serif;font-size:12px;font-weight:700;cursor:pointer}
.compact-account-actions button{width:100%}
.compact-account-error{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;border:1px solid color-mix(in oklch,var(--destructive) 15%,var(--border));border-radius:12px;background:var(--card);color:var(--destructive);padding:10px}
.compact-account-error strong,.compact-account-error p{display:block;font-size:12px}.compact-account-error strong{color:var(--foreground)}.compact-account-error p{margin-top:4px;color:var(--muted-foreground);line-height:1.4}.compact-account-error button{margin-top:8px}
.compact-account-skeleton{display:grid;gap:8px}.compact-account-skeleton>div,.compact-account-skeleton>section{border:1px solid var(--border);border-radius:12px;background:var(--card);padding:10px}.compact-account-skeleton span,.compact-account-skeleton strong{display:block;height:12px;border-radius:999px;background:color-mix(in oklch,var(--muted-foreground) 12%,transparent);animation:compact-account-pulse 1.4s ease-in-out infinite}.compact-account-skeleton strong{width:68%;margin-top:8px}.compact-account-skeleton section span+span{margin-top:8px}
.compact-account-close:focus-visible,.compact-account-wallet button:focus-visible,.compact-account-section-title button:focus-visible,.compact-account-actions button:focus-visible,.compact-account-error button:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.compact-account-close:active,.compact-account-section-title button:active,.compact-account-actions button:active,.compact-account-error button:active{transform:translateY(1px)}
@media(hover:hover){.compact-account-close:hover,.compact-account-section-title button:hover{background:var(--secondary);color:var(--foreground)}.compact-account-wallet button:hover{color:var(--primary)}.compact-account-actions button:hover,.compact-account-error button:hover{background:color-mix(in oklch,var(--destructive) 5%,var(--card))}}
@keyframes compact-account-pulse{0%,100%{opacity:.5}50%{opacity:1}}
`;

const STOCK_ASSETS = deploymentJson.stocks.map((stock) => ({
  mint: stock.mint,
  name:
    stock.symbol === "TSLA"
      ? "Tesla"
      : stock.symbol === "NVDA"
        ? "NVIDIA"
        : "GameStop",
  symbol: stock.symbol,
  tokenProgram: stock.tokenProgram,
}));

async function readAssociatedBalance(
  connection: Connection,
  owner: PublicKey,
  mintAddress: string,
  tokenProgramAddress: string,
) {
  const account = getAssociatedTokenAddressSync(
    new PublicKey(mintAddress),
    owner,
    false,
    new PublicKey(tokenProgramAddress),
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  try {
    const balance = await connection.getTokenAccountBalance(
      account,
      "confirmed",
    );
    return (
      balance.value.uiAmount ??
      Number(balance.value.amount) / 10 ** balance.value.decimals
    );
  } catch {
    return 0;
  }
}

export function WalletAccountModal({
  onClose,
  open,
}: WalletAccountModalProps) {
  const { connection } = useConnection();
  const { disconnect, publicKey } = useWallet();
  const reduceMotion = usePrefersReducedMotion();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const [balanceState, setBalanceState] = useState<BalanceState>({
    status: "loading",
  });
  const [copied, setCopied] = useState(false);
  const address = publicKey?.toBase58() ?? "";

  const loadBalances = useCallback(async () => {
    if (!publicKey) return;
    setBalanceState({ status: "loading" });

    try {
      const [lamports, ...stockAmounts] = await Promise.all([
        connection.getBalance(publicKey, "confirmed"),
        ...STOCK_ASSETS.map((stock) =>
          readAssociatedBalance(
            connection,
            publicKey,
            stock.mint,
            stock.tokenProgram,
          ),
        ),
      ]);

      setBalanceState({
        status: "ready",
        balances: {
          sol: lamports / LAMPORTS_PER_SOL,
          stocks: STOCK_ASSETS.map((stock, index) => ({
            amount: stockAmounts[index] ?? 0,
            name: stock.name,
            symbol: stock.symbol,
          })),
        },
      });
    } catch (error) {
      setBalanceState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The RPC could not load this wallet.",
      });
    }
  }, [connection, publicKey]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !publicKey) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    async function loadAfterOpen() {
      await Promise.resolve();
      await loadBalances();
    }
    void loadAfterOpen();

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
  }, [loadBalances, open, publicKey]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function handleDisconnect() {
    await disconnect();
    onClose();
  }

  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "No wallet";

  if (!mounted) return null;

  return createPortal(
    <>
      <style data-ripfolio-account>{ACCOUNT_MODAL_CSS}</style>
    <AnimatePresence>
      {open && publicKey ? (
        <motion.div
          className="compact-account-shell"
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
            className="compact-account-backdrop"
            onClick={onClose}
            tabIndex={-1}
            aria-label="Close wallet account"
          />

          <motion.div
            ref={panelRef}
            className="compact-account-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            initial={
              reduceMotion ? false : { opacity: 0, y: "100%" }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={
              reduceMotion ? undefined : { opacity: 0, y: "100%" }
            }
            transition={
              reduceMotion ? { duration: 0 } : MODAL_MOTION.panel
            }
          >
            <div className="compact-account-header">
              <h2 id="account-modal-title">Account</h2>
              <button
                ref={closeRef}
                type="button"
                className="compact-account-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="compact-account-wallet">
              <span className="compact-account-wallet-icon" aria-hidden="true">
                <WalletCards className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <button type="button" onClick={copyAddress} title={address}>
                  <span className="font-mono tabular-nums">{shortAddress}</span>
                  {copied ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  <span className="sr-only">{copied ? "Copied" : "Copy address"}</span>
                </button>
              </div>
              <span className="compact-account-network">
                <span aria-hidden="true" />
                Devnet
              </span>
            </div>

            <div className="compact-account-body">
              {balanceState.status === "loading" ? (
                <AccountBalanceSkeleton />
              ) : balanceState.status === "error" ? (
                <div className="compact-account-error" role="alert">
                  <RefreshCw className="size-5" aria-hidden="true" />
                  <div>
                    <strong>Couldn’t load balances</strong>
                    <p>{balanceState.message}</p>
                    <button type="button" onClick={() => void loadBalances()}>
                      Try again
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="compact-account-sol">
                    <BalanceCard
                      label="SOL balance"
                      value={
                        <>
                          <FormattedNumber
                            value={balanceState.balances.sol}
                            type="token_amount"
                            context="detailed"
                          />
                          <span>SOL</span>
                        </>
                      }
                    />
                  </div>

                  <section aria-labelledby="stock-balances-title">
                    <div className="compact-account-section-title">
                      <h3 id="stock-balances-title">Stock tokens</h3>
                      <button
                        type="button"
                        onClick={() => void loadBalances()}
                        aria-label="Refresh balances"
                      >
                        <RefreshCw className="size-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="compact-account-list">
                      {balanceState.balances.stocks.map((stock) => (
                        <div key={stock.symbol} className="compact-account-row">
                          <StockLogo symbol={stock.symbol} />
                          <div className="compact-account-stock-name">
                            <strong>{stock.symbol}</strong>
                            <span>{stock.name}</span>
                          </div>
                          <p>
                            <FormattedNumber
                              value={stock.amount}
                              type="token_amount"
                              context="detailed"
                            />
                            <span> tokens</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              <div className="compact-account-actions">
                <button type="button" onClick={handleDisconnect}>
                  <LogOut className="size-3.5" aria-hidden="true" />
                  Disconnect
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

const STOCK_LOGOS: Record<string, { height: number; src: string; width: number }> = {
  GME: { height: 14, src: "/stock-logos/gamestop.svg", width: 34 },
  NVDA: { height: 22, src: "/stock-logos/nvidia.svg", width: 22 },
  TSLA: { height: 22, src: "/stock-logos/tesla.svg", width: 22 },
};

function StockLogo({ symbol }: { symbol: string }) {
  const logo = STOCK_LOGOS[symbol];

  return (
    <span className="compact-account-logo" aria-hidden="true">
      {logo ? (
        <Image
          src={logo.src}
          alt=""
          width={logo.width}
          height={logo.height}
          unoptimized
          style={{ width: logo.width, height: logo.height }}
        />
      ) : (
        <WalletCards className="size-4" />
      )}
    </span>
  );
}

function BalanceCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong className="font-mono tabular-nums">{value}</strong>
    </article>
  );
}

function AccountBalanceSkeleton() {
  return (
    <div
      className="compact-account-skeleton"
      role="status"
      aria-label="Loading wallet balances"
    >
      <div>
        <span />
        <strong />
      </div>
      <section>
        <span />
        <span />
        <span />
      </section>
    </div>
  );
}
