"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  RefreshCw,
  UserRound,
  WalletCards,
} from "lucide-react";
import { WalletAccountModal } from "./wallet-account-modal";

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletControl({ compact = false }: { compact?: boolean }) {
  const { connected, connecting, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [accountOpen, setAccountOpen] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const address = publicKey?.toBase58() ?? null;

  useEffect(() => {
    function handleWalletError(event: Event) {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      setWalletError(message ?? "The wallet could not connect. Try again.");
    }

    window.addEventListener("market-rips:wallet-error", handleWalletError);
    return () => {
      window.removeEventListener("market-rips:wallet-error", handleWalletError);
    };
  }, []);

  if (!connected || !address) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setWalletError(null);
            setVisible(true);
          }}
          disabled={connecting}
          aria-busy={connecting}
          aria-label={connecting ? "Connecting wallet" : "Connect wallet"}
          className={`wallet-trigger cursor-pointer rounded-full bg-foreground text-background motion-safe:transition-[transform,filter] motion-safe:duration-100 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:cursor-wait disabled:opacity-70 ${compact ? "grid size-11 place-items-center" : "inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"}`}
        >
          {connecting ? (
            <RefreshCw className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : compact ? (
            <UserRound className="size-4" aria-hidden="true" />
          ) : (
            <WalletCards className="size-4" aria-hidden="true" />
          )}
          {!compact ? <span>{connecting ? "Connecting..." : "Connect wallet"}</span> : null}
        </button>
        {walletError ? (
          <div className="absolute right-0 top-full z-50 mt-3 w-72 rounded-2xl border border-destructive/25 bg-popover p-4 text-left shadow-lg" role="alert">
            <p className="text-sm font-semibold text-destructive">Couldn’t connect wallet</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{walletError}</p>
            <button
              type="button"
              onClick={() => {
                setWalletError(null);
                setVisible(true);
              }}
              className="mt-3 min-h-10 cursor-pointer rounded-full bg-secondary px-4 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Choose another wallet
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAccountOpen(true)}
        aria-expanded={accountOpen}
        aria-haspopup="dialog"
        title={address}
        aria-label={`Wallet ${truncateAddress(address)}`}
        className={`wallet-trigger cursor-pointer rounded-full border border-border bg-card shadow-sm motion-safe:transition-[transform,border-color] motion-safe:duration-100 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px ${compact ? "grid size-11 place-items-center" : "inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"}`}
      >
        {compact ? (
          <UserRound className="size-4" aria-hidden="true" />
        ) : (
          <>
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="font-mono tabular-nums">{truncateAddress(address)}</span>
          </>
        )}
      </button>
      <WalletAccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </div>
  );
}
