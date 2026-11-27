import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DELEGATION_PROGRAM_ID,
  MAGICBLOCK_EPHEMERAL_RPC_URL,
  PROGRAM_ID,
  SOLANA_RPC_URL,
  VRF_ORACLE_QUEUE,
  VRF_PROGRAM_ID,
  createProgram,
  deploymentPath,
  deriveDelegationAccounts,
  derivePackSession,
  deriveProgramIdentity,
  derivePurchase,
  enumVariant,
  loadDeployment,
  loadPayer,
  projectRoot,
  waitFor,
} from "./market-rips-client";

type PurchaseState = {
  status: Record<string, unknown>;
};

type PackSessionState = {
  selectedEntries: number[];
  revealedMask: number;
  claimedMask: number;
  vrfFulfilled: boolean;
  completed: boolean;
};

function listenForVrfCallback(connection: Connection): {
  promise: Promise<string | null>;
  cancel: () => Promise<void>;
} {
  let listenerId: number | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  const promise = new Promise<string | null>((resolveCallback) => {
    timeout = setTimeout(() => {
      settled = true;
      if (listenerId !== null) void connection.removeOnLogsListener(listenerId);
      resolveCallback(null);
    }, 120_000);
    listenerId = connection.onLogs(
      PROGRAM_ID,
      ({ logs, signature, err }) => {
        if (
          settled ||
          err ||
          !logs.some((log) => log.includes("Instruction: ConsumePackRandomness"))
        ) {
          return;
        }
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (listenerId !== null) void connection.removeOnLogsListener(listenerId);
        resolveCallback(signature);
      },
      "confirmed",
    );
  });
  return {
    promise,
    cancel: async () => {
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (listenerId !== null) await connection.removeOnLogsListener(listenerId);
    },
  };
}

async function main(): Promise<void> {
  const deployment = loadDeployment();
  const payer = loadPayer();
  const baseConnection = new Connection(SOLANA_RPC_URL, "confirmed");
  const erConnection = new Connection(MAGICBLOCK_EPHEMERAL_RPC_URL, {
    commitment: "confirmed",
    wsEndpoint: MAGICBLOCK_EPHEMERAL_RPC_URL.replace("https://", "wss://"),
  });
  const baseProgram = createProgram(baseConnection, payer);
  const erProgram = createProgram(erConnection, payer);
  const platform = new PublicKey(deployment.platform);
  const pack = new PublicKey(deployment.pack.address);
  const paymentMint = new PublicKey(deployment.payment.mint);
  const paymentTokenProgram = new PublicKey(deployment.payment.tokenProgram);
  const buyerPaymentAccount = new PublicKey(
    deployment.payment.authorityTokenAccount,
  );
  const nonce = new BN(Date.now().toString());
  const purchase = derivePurchase(payer.publicKey, nonce);
  const packSession = derivePackSession(purchase);
  const signatures: Record<string, string | string[]> = {};

  console.log(`Deployment: ${deploymentPath}`);
  console.log(`Buyer: ${payer.publicKey.toBase58()}`);
  console.log(`Purchase: ${purchase.toBase58()}`);

  signatures.buy = await baseProgram.methods
    .buyPack(nonce)
    .accounts({
      buyer: payer.publicKey,
      platform,
      pack,
      paymentMint,
      buyerPaymentAccount,
      paymentVault: new PublicKey(deployment.payment.vault),
      paymentTokenProgram,
      purchase,
      packSession,
      systemProgram: SystemProgram.programId,
    } as never)
    .rpc();
  console.log(`Bought pack: ${signatures.buy}`);

  const callbackListener = listenForVrfCallback(baseConnection);
  const clientSeed = Array.from(randomBytes(32));
  signatures.vrfRequest = await baseProgram.methods
    .requestPackRandomness(clientSeed)
    .accounts({
      buyer: payer.publicKey,
      pack,
      purchase,
      packSession,
      oracleQueue: VRF_ORACLE_QUEUE,
      programIdentity: deriveProgramIdentity(),
      vrfProgram: VRF_PROGRAM_ID,
      slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
      systemProgram: SystemProgram.programId,
    } as never)
    .rpc();
  console.log(`Requested VRF: ${signatures.vrfRequest}`);

  const fulfilled = await waitFor<PackSessionState>(
    "MagicBlock VRF callback",
    async () => {
      const purchaseState = (await baseProgram.account.purchase.fetch(
        purchase,
      )) as PurchaseState;
      const session = (await baseProgram.account.packSession.fetch(
        packSession,
      )) as PackSessionState;
      const status = enumVariant(purchaseState.status);
      console.log(`VRF status: ${status}`);
      return status === "resultReady" && session.vrfFulfilled ? session : null;
    },
    120_000,
  );
  const callbackSignature = await callbackListener.promise;
  if (callbackSignature) signatures.vrfCallback = callbackSignature;
  console.log(`VRF selected entries: ${fulfilled.selectedEntries.join(", ")}`);

  const delegation = deriveDelegationAccounts(packSession);
  signatures.delegate = await baseProgram.methods
    .delegatePackSession(purchase)
    .accounts({
      payer: payer.publicKey,
      ...delegation,
      packSession,
      ownerProgram: PROGRAM_ID,
      delegationProgram: DELEGATION_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as never)
    .rpc();
  console.log(`Delegated session: ${signatures.delegate}`);

  await waitFor(
    "PackSession delegation on Solana",
    async () => {
      const info = await baseConnection.getAccountInfo(packSession, "confirmed");
      return info?.owner.equals(DELEGATION_PROGRAM_ID) ? true : null;
    },
  );
  await waitFor(
    "PackSession clone on the Ephemeral Rollup",
    async () => {
      const info = await erConnection.getAccountInfo(packSession, "confirmed");
      return info ? true : null;
    },
  );

  const revealSignatures: string[] = [];
  for (let slot = 0; slot < 3; slot += 1) {
    const signature = await erProgram.methods
      .revealCard(slot)
      .accounts({
        payer: payer.publicKey,
        packSession,
        sessionToken: null,
      } as never)
      .rpc({ skipPreflight: true });
    revealSignatures.push(signature);
    console.log(`Revealed card ${slot}: ${signature}`);
  }
  signatures.reveal = revealSignatures;

  signatures.undelegate = await erProgram.methods
    .undelegatePackSession()
    .accounts({
      payer: payer.publicKey,
      packSession,
      sessionToken: null,
    } as never)
    .rpc({ skipPreflight: true });
  console.log(`Committed and undelegated: ${signatures.undelegate}`);

  const committedSession = await waitFor<PackSessionState>(
    "committed PackSession on Solana",
    async () => {
      const info = await baseConnection.getAccountInfo(packSession, "confirmed");
      if (!info?.owner.equals(PROGRAM_ID)) return null;
      const session = (await baseProgram.account.packSession.fetch(
        packSession,
      )) as PackSessionState;
      return session.completed ? session : null;
    },
    120_000,
  );

  const expectedByMint = new Map<string, bigint>();
  for (const entryIndex of committedSession.selectedEntries) {
    const stock = deployment.stocks[entryIndex];
    if (!stock) throw new Error(`Missing stock config for entry ${entryIndex}`);
    expectedByMint.set(
      stock.mint,
      (expectedByMint.get(stock.mint) ?? 0n) + BigInt(stock.rawAmountPerPull),
    );
  }

  const startingByMint = new Map<string, bigint>();
  for (const mintAddress of expectedByMint.keys()) {
    const stock = deployment.stocks.find((item) => item.mint === mintAddress);
    if (!stock) throw new Error(`Unknown stock mint ${mintAddress}`);
    const mint = new PublicKey(mintAddress);
    const tokenProgram = new PublicKey(stock.tokenProgram);
    const buyerAccount = getAssociatedTokenAddressSync(
      mint,
      payer.publicKey,
      false,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const account = await getAccount(
      baseConnection,
      buyerAccount,
      "confirmed",
      tokenProgram,
    );
    startingByMint.set(mintAddress, account.amount);
  }

  const claimSignatures: string[] = [];
  for (let slot = 0; slot < committedSession.selectedEntries.length; slot += 1) {
    const entryIndex = committedSession.selectedEntries[slot];
    const stock = deployment.stocks[entryIndex];
    if (!stock) throw new Error(`Missing stock config for entry ${entryIndex}`);
    const stockMint = new PublicKey(stock.mint);
    const stockTokenProgram = new PublicKey(stock.tokenProgram);
    const buyerStockAccount = getAssociatedTokenAddressSync(
      stockMint,
      payer.publicKey,
      false,
      stockTokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const signature = await baseProgram.methods
      .claimPrize(slot)
      .accounts({
        payer: payer.publicKey,
        buyer: payer.publicKey,
        platform,
        pack,
        purchase,
        packSession,
        stockMint,
        prizeVault: new PublicKey(stock.prizeVault),
        buyerStockAccount,
        stockTokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as never)
      .rpc();
    claimSignatures.push(signature);
    console.log(`Claimed card ${slot} (${stock.symbol}): ${signature}`);
  }
  signatures.claim = claimSignatures;

  const finalPurchase = (await baseProgram.account.purchase.fetch(
    purchase,
  )) as PurchaseState;
  if (enumVariant(finalPurchase.status) !== "settled") {
    throw new Error(`Purchase ended as ${enumVariant(finalPurchase.status)}`);
  }

  for (const [mintAddress, minimumAmount] of expectedByMint) {
    const stock = deployment.stocks.find((item) => item.mint === mintAddress);
    if (!stock) throw new Error(`Unknown stock mint ${mintAddress}`);
    const mint = new PublicKey(mintAddress);
    const tokenProgram = new PublicKey(stock.tokenProgram);
    const buyerAccount = getAssociatedTokenAddressSync(
      mint,
      payer.publicKey,
      false,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const account = await getAccount(
      baseConnection,
      buyerAccount,
      "confirmed",
      tokenProgram,
    );
    const expectedFinal =
      (startingByMint.get(mintAddress) ?? 0n) + minimumAmount;
    if (account.amount !== expectedFinal) {
      throw new Error(
        `Claim balance check failed for ${stock.symbol}: expected ${expectedFinal}, got ${account.amount}`,
      );
    }
  }

  const report = {
    completedAt: new Date().toISOString(),
    programId: PROGRAM_ID.toBase58(),
    purchase: purchase.toBase58(),
    packSession: packSession.toBase58(),
    selectedEntries: committedSession.selectedEntries,
    selectedSymbols: committedSession.selectedEntries.map(
      (index) => deployment.stocks[index]?.symbol ?? `entry-${index}`,
    ),
    finalStatus: enumVariant(finalPurchase.status),
    signatures,
  };
  const reportPath = resolve(projectRoot, "deployments", "devnet-last-run.json");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
