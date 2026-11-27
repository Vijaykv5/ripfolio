import "client-only";

import {
  AnchorProvider,
  BN,
  Program,
} from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SystemProgram,
  Transaction,
  type Commitment,
} from "@solana/web3.js";
import deploymentJson from "@/deployments/devnet.json";
import idlJson from "@/target/idl/market_rips.json";
import type { MarketRips } from "@/target/types/market_rips";

const COMMITMENT: Commitment = "confirmed";

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

export const MAGICBLOCK_EPHEMERAL_RPC_URL =
  process.env.NEXT_PUBLIC_MAGICBLOCK_EPHEMERAL_RPC_URL ??
  "https://devnet.magicblock.app";

export type StockSymbol = "TSLA" | "NVDA" | "GME";

type StockDeployment = {
  symbol: StockSymbol;
  mint: string;
  tokenProgram: string;
  prizeVault: string;
  rawAmountPerPull: string;
};

type DevnetDeployment = {
  programId: string;
  platform: string;
  payment: {
    mint: string;
    tokenProgram: string;
    vault: string;
  };
  pack: {
    address: string;
    priceRaw: string;
  };
  stocks: StockDeployment[];
};

export type PackReward = {
  symbol: StockSymbol;
  amount: number;
  mint: string;
  entryIndex: number;
};

export type PackAddresses = {
  nonce: BN;
  purchase: PublicKey;
  packSession: PublicKey;
};

export type PackSessionState = {
  selectedEntries: number[];
  revealedMask: number;
  claimedMask: number;
  vrfFulfilled: boolean;
  completed: boolean;
};

type PurchaseState = {
  status: Record<string, unknown>;
};

const deployment = deploymentJson as DevnetDeployment;
const textEncoder = new TextEncoder();

export const PACK_PRICE_RAW = BigInt(deployment.pack.priceRaw);
export const PACK_PRICE_USDC = Number(PACK_PRICE_RAW) / 1_000_000;
const MINIMUM_DEVNET_SOL = 0.03;

export type PackErrorKind =
  | "payment-funds"
  | "sol-funds"
  | "rejected"
  | "network"
  | "unavailable"
  | "unknown";

export type PackErrorDetails = {
  kind: PackErrorKind;
  message: string;
  retryable: boolean;
};

export function createMarketRipsPrograms(
  baseConnection: Connection,
  wallet: ConstructorParameters<typeof AnchorProvider>[1],
): {
  baseProgram: Program<MarketRips>;
  erProgram: Program<MarketRips>;
  erConnection: Connection;
} {
  const options = {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  } as const;
  const erConnection = new Connection(MAGICBLOCK_EPHEMERAL_RPC_URL, {
    commitment: COMMITMENT,
    wsEndpoint: MAGICBLOCK_EPHEMERAL_RPC_URL.replace("https://", "wss://"),
  });
  const baseProvider = new AnchorProvider(baseConnection, wallet, options);
  const erProvider = new AnchorProvider(erConnection, wallet, options);
  const idl = idlJson as unknown as MarketRips;

  return {
    baseProgram: new Program(idl, baseProvider),
    erProgram: new Program(idl, erProvider),
    erConnection,
  };
}

export function createPackAddresses(buyer: PublicKey): PackAddresses {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  const nonce = new BN(Date.now().toString())
    .mul(new BN(1_000_000))
    .add(new BN(random));
  const purchase = derivePurchase(buyer, nonce);
  return {
    nonce,
    purchase,
    packSession: derivePackSession(purchase),
  };
}

export async function buildBuyAndRandomnessTransaction(
  program: Program<MarketRips>,
  buyer: PublicKey,
  addresses: PackAddresses,
): Promise<Transaction> {
  const platform = new PublicKey(deployment.platform);
  const pack = new PublicKey(deployment.pack.address);
  const paymentMint = new PublicKey(deployment.payment.mint);
  const paymentTokenProgram = new PublicKey(deployment.payment.tokenProgram);
  const buyerPaymentAccount = getAssociatedTokenAddressSync(
    paymentMint,
    buyer,
    false,
    paymentTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const seed = Array.from(crypto.getRandomValues(new Uint8Array(32)));

  const buyInstruction = await program.methods
    .buyPack(addresses.nonce)
    .accounts({
      buyer,
      platform,
      pack,
      paymentMint,
      buyerPaymentAccount,
      paymentVault: new PublicKey(deployment.payment.vault),
      paymentTokenProgram,
      purchase: addresses.purchase,
      packSession: addresses.packSession,
      systemProgram: SystemProgram.programId,
    } as never)
    .instruction();

  const randomnessInstruction = await program.methods
    .requestPackRandomness(seed as never)
    .accounts({
      buyer,
      pack,
      purchase: addresses.purchase,
      packSession: addresses.packSession,
      oracleQueue: VRF_ORACLE_QUEUE,
      programIdentity: deriveProgramIdentity(),
      vrfProgram: VRF_PROGRAM_ID,
      slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
      systemProgram: SystemProgram.programId,
    } as never)
    .instruction();

  return new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
    buyInstruction,
    randomnessInstruction,
  );
}

export async function assertPackCanBePurchased(
  connection: Connection,
  buyer: PublicKey,
): Promise<void> {
  const paymentMint = new PublicKey(deployment.payment.mint);
  const paymentTokenProgram = new PublicKey(deployment.payment.tokenProgram);
  const buyerPaymentAccount = getAssociatedTokenAddressSync(
    paymentMint,
    buyer,
    false,
    paymentTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  let balance: Awaited<ReturnType<Connection["getTokenAccountBalance"]>> | null;
  try {
    balance = await connection.getTokenAccountBalance(
      buyerPaymentAccount,
      COMMITMENT,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/could not find account|accountnotfound|invalid param/i.test(message)) {
      balance = null;
    } else {
      throw new Error("Devnet RPC could not read your token balance.");
    }
  }

  if (!balance || BigInt(balance.value.amount) < PACK_PRICE_RAW) {
    throw new Error(`You need ${PACK_PRICE_USDC} mock USDC on devnet.`);
  }

  const solBalance = await connection.getBalance(buyer, COMMITMENT);
  if (solBalance < MINIMUM_DEVNET_SOL * LAMPORTS_PER_SOL) {
    throw new Error(
      `You need at least ${MINIMUM_DEVNET_SOL} devnet SOL for fees and accounts.`,
    );
  }
}

export async function waitForRandomness(
  program: Program<MarketRips>,
  addresses: PackAddresses,
  timeoutMs = 120_000,
): Promise<PackSessionState> {
  return waitFor("MagicBlock randomness", async () => {
    const purchase = (await program.account.purchase.fetch(
      addresses.purchase,
    )) as PurchaseState;
    const session = (await program.account.packSession.fetch(
      addresses.packSession,
    )) as PackSessionState;
    return enumVariant(purchase.status) === "resultReady" && session.vrfFulfilled
      ? session
      : null;
  }, timeoutMs);
}

export async function buildDelegateTransaction(
  program: Program<MarketRips>,
  buyer: PublicKey,
  addresses: PackAddresses,
): Promise<Transaction> {
  const delegation = deriveDelegationAccounts(addresses.packSession);
  const instruction = await program.methods
    .delegatePackSession(addresses.purchase)
    .accounts({
      payer: buyer,
      ...delegation,
      packSession: addresses.packSession,
      ownerProgram: PROGRAM_ID,
      delegationProgram: DELEGATION_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as never)
    .instruction();
  return new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
    instruction,
  );
}

export async function waitForDelegation(
  baseConnection: Connection,
  erConnection: Connection,
  packSession: PublicKey,
): Promise<void> {
  await waitFor("session delegation", async () => {
    const account = await baseConnection.getAccountInfo(packSession, COMMITMENT);
    return account?.owner.equals(DELEGATION_PROGRAM_ID) ? true : null;
  });
  await waitFor("MagicBlock session", async () => {
    const account = await erConnection.getAccountInfo(packSession, COMMITMENT);
    return account ? true : null;
  });
}

export async function buildRevealTransaction(
  program: Program<MarketRips>,
  buyer: PublicKey,
  packSession: PublicKey,
): Promise<Transaction> {
  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
  );
  for (let slot = 0; slot < 3; slot += 1) {
    transaction.add(
      await program.methods
        .revealCard(slot)
        .accounts({ payer: buyer, packSession, sessionToken: null } as never)
        .instruction(),
    );
  }
  transaction.add(
    await program.methods
      .undelegatePackSession()
      .accounts({ payer: buyer, packSession, sessionToken: null } as never)
      .instruction(),
  );
  return transaction;
}

export async function waitForUndelegation(
  baseConnection: Connection,
  program: Program<MarketRips>,
  packSession: PublicKey,
): Promise<PackSessionState> {
  return waitFor("settled reveal", async () => {
    const account = await baseConnection.getAccountInfo(packSession, COMMITMENT);
    if (!account?.owner.equals(PROGRAM_ID)) return null;
    const session = (await program.account.packSession.fetch(
      packSession,
    )) as PackSessionState;
    return session.completed ? session : null;
  }, 120_000);
}

export async function buildClaimTransaction(
  program: Program<MarketRips>,
  payer: PublicKey,
  addresses: PackAddresses,
  session: PackSessionState,
): Promise<Transaction> {
  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
  );
  const platform = new PublicKey(deployment.platform);
  const pack = new PublicKey(deployment.pack.address);

  for (let slot = 0; slot < session.selectedEntries.length; slot += 1) {
    const stock = deployment.stocks[session.selectedEntries[slot]];
    if (!stock) throw new Error("The selected stock is missing from this pack.");
    const stockMint = new PublicKey(stock.mint);
    const stockTokenProgram = new PublicKey(stock.tokenProgram);
    const buyerStockAccount = getAssociatedTokenAddressSync(
      stockMint,
      payer,
      false,
      stockTokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    transaction.add(
      await program.methods
        .claimPrize(slot)
        .accounts({
          payer,
          buyer: payer,
          platform,
          pack,
          purchase: addresses.purchase,
          packSession: addresses.packSession,
          stockMint,
          prizeVault: new PublicKey(stock.prizeVault),
          buyerStockAccount,
          stockTokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as never)
        .instruction(),
    );
  }
  return transaction;
}

export function rewardsFromSession(session: PackSessionState): PackReward[] {
  return session.selectedEntries.map((entryIndex) => {
    const stock = deployment.stocks[entryIndex];
    if (!stock) throw new Error("The selected stock is missing from this pack.");
    return {
      symbol: stock.symbol,
      amount: Number(BigInt(stock.rawAmountPerPull)) / 1_000_000,
      mint: stock.mint,
      entryIndex,
    };
  });
}

export function describeProgramError(error: unknown): PackErrorDetails {
  const message = error instanceof Error ? error.message : String(error);
  if (/mock USDC|token balance|token account/i.test(message)) {
    return {
      kind: "payment-funds",
      message: `This wallet needs ${PACK_PRICE_USDC} mock USDC on devnet.`,
      retryable: true,
    };
  }
  if (/devnet SOL|insufficient funds for fee|insufficient lamports|0x1/i.test(message)) {
    return {
      kind: "sol-funds",
      message: `This wallet needs at least ${MINIMUM_DEVNET_SOL} devnet SOL.`,
      retryable: true,
    };
  }
  if (/reject|declin|cancel/i.test(message)) {
    return { kind: "rejected", message: "Signature cancelled.", retryable: true };
  }
  if (/blockhash/i.test(message)) {
    return {
      kind: "network",
      message: "The network moved ahead. Try again.",
      retryable: true,
    };
  }
  if (/timeout|timed out/i.test(message)) {
    return {
      kind: "network",
      message: "The network is still processing. Try again.",
      retryable: true,
    };
  }
  if (/429|rate limit|failed to fetch|unable to connect|RPC could not/i.test(message)) {
    return {
      kind: "network",
      message: "Devnet RPC is unavailable. Try again shortly.",
      retryable: true,
    };
  }
  if (/packdisabled|insufficientinventory|platformpaused/i.test(message)) {
    return {
      kind: "unavailable",
      message: "This pack is unavailable right now.",
      retryable: false,
    };
  }

  const firstLine = message.split("\n")[0]?.replace(/^Error:\s*/, "").trim();
  return {
    kind: "unknown",
    message:
      process.env.NODE_ENV === "development" && firstLine
        ? firstLine.slice(0, 160)
        : "The devnet transaction failed. Try again.",
    retryable: true,
  };
}

export function formatProgramError(error: unknown): string {
  return describeProgramError(error).message;
}

export function enumVariant(value: unknown): string {
  if (!value || typeof value !== "object") return String(value);
  return Object.keys(value as Record<string, unknown>)[0] ?? "unknown";
}

function seed(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function u64Seed(value: BN): Uint8Array {
  return Uint8Array.from(value.toArray("le", 8));
}

function derivePurchase(buyer: PublicKey, nonce: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [seed("purchase"), buyer.toBytes(), u64Seed(nonce)],
    PROGRAM_ID,
  )[0];
}

function derivePackSession(purchase: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [seed("session"), purchase.toBytes()],
    PROGRAM_ID,
  )[0];
}

function deriveProgramIdentity(): PublicKey {
  return PublicKey.findProgramAddressSync([seed("identity")], PROGRAM_ID)[0];
}

function deriveDelegationAccounts(packSession: PublicKey): {
  bufferPackSession: PublicKey;
  delegationRecordPackSession: PublicKey;
  delegationMetadataPackSession: PublicKey;
} {
  return {
    bufferPackSession: PublicKey.findProgramAddressSync(
      [seed("buffer"), packSession.toBytes()],
      PROGRAM_ID,
    )[0],
    delegationRecordPackSession: PublicKey.findProgramAddressSync(
      [seed("delegation"), packSession.toBytes()],
      DELEGATION_PROGRAM_ID,
    )[0],
    delegationMetadataPackSession: PublicKey.findProgramAddressSync(
      [seed("delegation-metadata"), packSession.toBytes()],
      DELEGATION_PROGRAM_ID,
    )[0],
  };
}

async function waitFor<T>(
  label: string,
  read: () => Promise<T | null>,
  timeoutMs = 90_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await read();
      if (result !== null) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1_500));
  }
  const suffix = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}
