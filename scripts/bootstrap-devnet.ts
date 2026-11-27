import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  PROGRAM_ID,
  SOLANA_RPC_URL,
  createProgram,
  deploymentPath,
  derivePack,
  derivePlatform,
  loadDeployment,
  loadPayer,
  type DevnetDeployment,
  type StockDeployment,
} from "./market-rips-client";

const PAYMENT_DECIMALS = 6;
const STOCK_DECIMALS = 6;
const PAYMENT_SUPPLY = 1_000_000n * 10n ** BigInt(PAYMENT_DECIMALS);
const STOCK_SUPPLY = 1_000n * 10n ** BigInt(STOCK_DECIMALS);
const RAW_AMOUNT_PER_PULL = 1_000_000n;
const STOCK_UNITS = 30;
const PACK_ID = new BN(1);
const PACK_PRICE = new BN(10_000_000);
const REVEAL_TIMEOUT_SECONDS = 600;

async function createFundedMint(
  connection: Connection,
  payer: Keypair,
  tokenProgram: PublicKey,
  decimals: number,
  supply: bigint,
): Promise<{ mint: PublicKey; tokenAccount: PublicKey }> {
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    decimals,
    Keypair.generate(),
    { commitment: "confirmed" },
    tokenProgram,
  );
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  await mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    payer,
    supply,
    [],
    { commitment: "confirmed" },
    tokenProgram,
  );
  return { mint, tokenAccount: tokenAccount.address };
}

async function createDeployment(
  connection: Connection,
  payer: Keypair,
): Promise<DevnetDeployment> {
  const platform = derivePlatform();
  const pack = derivePack(platform, PACK_ID);
  const payment = await createFundedMint(
    connection,
    payer,
    TOKEN_PROGRAM_ID,
    PAYMENT_DECIMALS,
    PAYMENT_SUPPLY,
  );
  const paymentVault = getAssociatedTokenAddressSync(
    payment.mint,
    platform,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const stocks: StockDeployment[] = [];
  for (const symbol of ["TSLA", "NVDA", "GME"] as const) {
    const stock = await createFundedMint(
      connection,
      payer,
      TOKEN_2022_PROGRAM_ID,
      STOCK_DECIMALS,
      STOCK_SUPPLY,
    );
    stocks.push({
      symbol,
      mint: stock.mint.toBase58(),
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
      authorityTokenAccount: stock.tokenAccount.toBase58(),
      prizeVault: getAssociatedTokenAddressSync(
        stock.mint,
        pack,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ).toBase58(),
      rawAmountPerPull: RAW_AMOUNT_PER_PULL.toString(),
      units: STOCK_UNITS,
    });
  }

  return {
    cluster: "devnet",
    rpcUrl: SOLANA_RPC_URL,
    programId: PROGRAM_ID.toBase58(),
    authority: payer.publicKey.toBase58(),
    platform: platform.toBase58(),
    payment: {
      mint: payment.mint.toBase58(),
      tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
      authorityTokenAccount: payment.tokenAccount.toBase58(),
      vault: paymentVault.toBase58(),
    },
    pack: {
      id: PACK_ID.toString(),
      address: pack.toBase58(),
      priceRaw: PACK_PRICE.toString(),
      revealTimeoutSeconds: REVEAL_TIMEOUT_SECONDS,
    },
    stocks,
    createdAt: new Date().toISOString(),
    bootstrapSignatures: [],
  };
}

function saveDeployment(deployment: DevnetDeployment): void {
  mkdirSync(dirname(deploymentPath), { recursive: true });
  writeFileSync(
    deploymentPath,
    `${JSON.stringify(deployment, null, 2)}\n`,
    "utf8",
  );
}

async function main(): Promise<void> {
  const payer = loadPayer();
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const program = createProgram(connection, payer);
  const balance = await connection.getBalance(payer.publicKey, "confirmed");
  console.log(`Authority: ${payer.publicKey.toBase58()}`);
  console.log(`Balance: ${balance / 1_000_000_000} SOL`);

  let deployment: DevnetDeployment;
  if (existsSync(deploymentPath)) {
    deployment = loadDeployment();
    if (deployment.authority !== payer.publicKey.toBase58()) {
      throw new Error("Existing deployment belongs to a different authority");
    }
    console.log(`Reusing ${deploymentPath}`);
  } else {
    console.log("Creating mock USDC and TSLA/NVDA/GME mints...");
    deployment = await createDeployment(connection, payer);
    saveDeployment(deployment);
  }

  const platform = new PublicKey(deployment.platform);
  const pack = new PublicKey(deployment.pack.address);
  const paymentMint = new PublicKey(deployment.payment.mint);
  const paymentTokenProgram = new PublicKey(deployment.payment.tokenProgram);

  if (!(await connection.getAccountInfo(platform, "confirmed"))) {
    const signature = await program.methods
      .initializePlatform(0)
      .accounts({
        authority: payer.publicKey,
        paymentMint,
        platform,
        paymentVault: new PublicKey(deployment.payment.vault),
        paymentTokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as never)
      .rpc();
    deployment.bootstrapSignatures.push(signature);
    saveDeployment(deployment);
    console.log(`Initialized platform: ${signature}`);
  }

  if (!(await connection.getAccountInfo(pack, "confirmed"))) {
    const signature = await program.methods
      .createPack(
        new BN(deployment.pack.id),
        new BN(deployment.pack.priceRaw),
        new BN(deployment.pack.revealTimeoutSeconds),
      )
      .accounts({
        authority: payer.publicKey,
        platform,
        pack,
        systemProgram: SystemProgram.programId,
      } as never)
      .rpc();
    deployment.bootstrapSignatures.push(signature);
    saveDeployment(deployment);
    console.log(`Created pack: ${signature}`);
  }

  let packState = (await program.account.packConfig.fetch(pack)) as {
    entryCount: number;
    entries: Array<{ mint: PublicKey }>;
    enabled: boolean;
  };

  for (let index = 0; index < deployment.stocks.length; index += 1) {
    const stock = deployment.stocks[index];
    const stockMint = new PublicKey(stock.mint);
    if (index < packState.entryCount) {
      if (!packState.entries[index].mint.equals(stockMint)) {
        throw new Error(`Pack entry ${index} does not match ${stock.symbol}`);
      }
      continue;
    }

    const signature = await program.methods
      .addPrizeEntry(new BN(stock.rawAmountPerPull), stock.units)
      .accounts({
        authority: payer.publicKey,
        platform,
        pack,
        stockMint,
        authorityStockAccount: new PublicKey(stock.authorityTokenAccount),
        prizeVault: new PublicKey(stock.prizeVault),
        stockTokenProgram: new PublicKey(stock.tokenProgram),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as never)
      .rpc();
    deployment.bootstrapSignatures.push(signature);
    saveDeployment(deployment);
    console.log(`Funded ${stock.symbol} vault: ${signature}`);
    packState = (await program.account.packConfig.fetch(pack)) as typeof packState;
  }

  if (!packState.enabled) {
    const signature = await program.methods
      .setPackEnabled(true)
      .accounts({ authority: payer.publicKey, platform, pack } as never)
      .rpc();
    deployment.bootstrapSignatures.push(signature);
    saveDeployment(deployment);
    console.log(`Enabled pack: ${signature}`);
  }

  const finalState = (await program.account.packConfig.fetch(pack)) as {
    entryCount: number;
    enabled: boolean;
    entries: Array<{ availableUnits: number }>;
  };
  console.log(
    JSON.stringify(
      {
        deployment: deploymentPath,
        platform: deployment.platform,
        pack: deployment.pack.address,
        paymentMint: deployment.payment.mint,
        stocks: deployment.stocks.map(({ symbol, mint }) => ({ symbol, mint })),
        entryCount: finalState.entryCount,
        enabled: finalState.enabled,
        availableUnits: finalState.entries
          .slice(0, finalState.entryCount)
          .map((entry) => entry.availableUnits),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
