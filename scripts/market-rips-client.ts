import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MarketRips } from "../target/types/market_rips";

export const PROGRAM_ID = new PublicKey(
  "Fu7hq2ZxsxDfmTFvMN6kxaZa6z5uB1ENKiH4Af2HwkbL",
);
export const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
);
export const VRF_PROGRAM_ID = new PublicKey(
  "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz",
);
export const VRF_ORACLE_QUEUE = new PublicKey(
  "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh",
);

export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const MAGICBLOCK_EPHEMERAL_RPC_URL =
  process.env.MAGICBLOCK_EPHEMERAL_RPC_URL ??
  "https://devnet.magicblock.app";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(scriptsDirectory, "..");
export const deploymentPath = resolve(
  projectRoot,
  "deployments",
  "devnet.json",
);

export type StockDeployment = {
  symbol: "TSLA" | "NVDA" | "GME";
  mint: string;
  tokenProgram: string;
  authorityTokenAccount: string;
  prizeVault: string;
  rawAmountPerPull: string;
  units: number;
};

export type DevnetDeployment = {
  cluster: "devnet";
  rpcUrl: string;
  programId: string;
  authority: string;
  platform: string;
  payment: {
    mint: string;
    tokenProgram: string;
    authorityTokenAccount: string;
    vault: string;
  };
  pack: {
    id: string;
    address: string;
    priceRaw: string;
    revealTimeoutSeconds: number;
  };
  stocks: StockDeployment[];
  createdAt: string;
  bootstrapSignatures: string[];
};

function expandHome(path: string): string {
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : path;
}

export function loadPayer(): Keypair {
  const walletPath = expandHome(
    process.env.ANCHOR_WALLET ?? "~/.config/solana/id.json",
  );
  const bytes = JSON.parse(readFileSync(walletPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export function loadDeployment(): DevnetDeployment {
  return JSON.parse(readFileSync(deploymentPath, "utf8")) as DevnetDeployment;
}

export function createProvider(
  connection: Connection,
  payer: Keypair,
): AnchorProvider {
  const wallet = new Wallet(payer);
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

export function createProgram(
  connection: Connection,
  payer: Keypair,
): Program<MarketRips> {
  const idlPath = resolve(projectRoot, "target", "idl", "market_rips.json");
  const idl = JSON.parse(
    readFileSync(idlPath, "utf8"),
  ) as unknown as MarketRips;
  return new Program(idl, createProvider(connection, payer));
}

export function u64Seed(value: BN): Buffer {
  return value.toArrayLike(Buffer, "le", 8);
}

export function derivePlatform(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_ID,
  )[0];
}

export function derivePack(platform: PublicKey, packId: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pack"), platform.toBuffer(), u64Seed(packId)],
    PROGRAM_ID,
  )[0];
}

export function derivePurchase(buyer: PublicKey, nonce: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("purchase"), buyer.toBuffer(), u64Seed(nonce)],
    PROGRAM_ID,
  )[0];
}

export function derivePackSession(purchase: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("session"), purchase.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function deriveProgramIdentity(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("identity")],
    PROGRAM_ID,
  )[0];
}

export function deriveDelegationAccounts(packSession: PublicKey): {
  bufferPackSession: PublicKey;
  delegationRecordPackSession: PublicKey;
  delegationMetadataPackSession: PublicKey;
} {
  return {
    bufferPackSession: PublicKey.findProgramAddressSync(
      [Buffer.from("buffer"), packSession.toBuffer()],
      PROGRAM_ID,
    )[0],
    delegationRecordPackSession: PublicKey.findProgramAddressSync(
      [Buffer.from("delegation"), packSession.toBuffer()],
      DELEGATION_PROGRAM_ID,
    )[0],
    delegationMetadataPackSession: PublicKey.findProgramAddressSync(
      [Buffer.from("delegation-metadata"), packSession.toBuffer()],
      DELEGATION_PROGRAM_ID,
    )[0],
  };
}

export function enumVariant(value: unknown): string {
  if (!value || typeof value !== "object") return String(value);
  return Object.keys(value as Record<string, unknown>)[0] ?? "unknown";
}

export async function waitFor<T>(
  description: string,
  read: () => Promise<T | null>,
  timeoutMs = 90_000,
  intervalMs = 2_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await read();
      if (value !== null) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
  }
  const suffix =
    lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${description}.${suffix}`);
}

export async function sendTransaction(
  connection: Connection,
  payer: Keypair,
  transaction: Transaction | VersionedTransaction,
): Promise<string> {
  if (transaction instanceof Transaction) {
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash("confirmed")
    ).blockhash;
    transaction.sign(payer);
  } else {
    transaction.sign([payer]);
  }
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: false, preflightCommitment: "confirmed" },
  );
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    { signature, ...latest },
    "confirmed",
  );
  return signature;
}

export const systemProgram = SystemProgram.programId;
