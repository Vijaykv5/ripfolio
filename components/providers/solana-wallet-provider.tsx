"use client";

import { useMemo, type ReactNode } from "react";
import { WalletAdapterNetwork, type WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

interface SolanaWalletProviderProps {
  children: ReactNode;
}

const network = WalletAdapterNetwork.Devnet;

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl(network);
  const wallets = useMemo(() => [], []);

  function handleWalletError(error: WalletError) {
    window.dispatchEvent(
      new CustomEvent("market-rips:wallet-error", {
        detail: { message: error.message || "The wallet could not connect." },
      }),
    );
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={handleWalletError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
