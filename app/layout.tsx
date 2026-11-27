import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SolanaWalletProvider } from "@/components/providers/solana-wallet-provider";

const sora = localFont({
  src: "./fonts/Sora-Variable.ttf",
  variable: "--font-sora",
  display: "swap",
  weight: "100 800",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Market Rips — Asset-backed stock packs",
  description: "Open asset-backed stock-card packs on Solana.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      </body>
    </html>
  );
}
