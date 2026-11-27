"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  UserRound,
  WalletCards,
} from "lucide-react";

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletControl({ compact = false }: { compact?: boolean }) {
  const { connected, connecting, disconnect, publicKey, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const address = publicKey?.toBase58() ?? null;

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    function handleWalletError(event: Event) {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      setWalletError(message ?? "The wallet could not connect. Try again.");
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("market-rips:wallet-error", handleWalletError);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("market-rips:wallet-error", handleWalletError);
    };
  }, []);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function handleDisconnect() {
    await disconnect();
    setMenuOpen(false);
  }

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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title={address}
        aria-label={`Wallet ${truncateAddress(address)}`}
        className={`wallet-trigger cursor-pointer rounded-full border border-border bg-card shadow-sm motion-safe:transition-[transform,border-color] motion-safe:duration-100 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px ${compact ? "grid size-11 place-items-center" : "inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"}`}
      >
        {compact ? (
          <UserRound className="size-4" aria-hidden="true" />
        ) : (
          <>
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="hidden text-muted-foreground sm:inline">{wallet?.adapter.name}</span>
            <span className="font-mono tabular-nums">{truncateAddress(address)}</span>
            <ChevronDown className={`size-4 text-muted-foreground motion-safe:transition-transform motion-safe:duration-150 ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </>
        )}
      </button>

      {menuOpen ? (
        <div className="wallet-menu absolute right-0 top-full z-50 mt-3 w-72 rounded-2xl border border-border bg-popover p-2 shadow-lg" role="menu">
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground">Connected with {wallet?.adapter.name}</p>
            <p className="mt-1 break-all font-mono text-xs tabular-nums text-foreground">{address}</p>
          </div>
          <div className="my-2 h-px bg-border" />
          <WalletMenuButton onClick={copyAddress} icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy address"} />
          <a
            href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
            className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground motion-safe:transition-colors motion-safe:duration-100 hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            View on explorer
          </a>
          <WalletMenuButton onClick={handleDisconnect} icon={LogOut} label="Disconnect" destructive />
        </div>
      ) : null}
    </div>
  );
}

interface WalletMenuButtonProps {
  onClick: () => void | Promise<void>;
  icon: typeof Copy;
  label: string;
  destructive?: boolean;
}

function WalletMenuButton({ onClick, icon: Icon, label, destructive }: WalletMenuButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium motion-safe:transition-colors motion-safe:duration-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
        destructive ? "text-destructive hover:bg-destructive/8" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
