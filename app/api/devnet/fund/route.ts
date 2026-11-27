import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import deploymentJson from "@/deployments/devnet.json";

const TARGET_USDC_RAW = 20_000_000n;
const TARGET_SOL_LAMPORTS = 100_000_000;

type FundRequest = {
  wallet?: string;
};

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function loadFaucetPayer(): Promise<Keypair> {
  const inlineSecret = process.env.DEVNET_FAUCET_SECRET_KEY;
  if (inlineSecret) {
    const bytes = JSON.parse(inlineSecret) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }

  const configuredPath = process.env.ANCHOR_WALLET ?? "~/.config/solana/id.json";
  const walletPath = configuredPath.startsWith("~/")
    ? resolve(homedir(), configuredPath.slice(2))
    : resolve(configuredPath);
  const bytes = JSON.parse(await readFile(walletPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export async function POST(request: Request) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DEVNET_FAUCET !== "true"
  ) {
    return Response.json({ error: "Devnet funding is disabled." }, { status: 403 });
  }
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as FundRequest;
    if (!body.wallet) {
      return Response.json({ error: "Wallet address is required." }, { status: 400 });
    }

    const recipient = new PublicKey(body.wallet);
    const payer = await loadFaucetPayer();
    const deployment = deploymentJson;
    if (payer.publicKey.toBase58() !== deployment.authority) {
      throw new Error("The configured faucet wallet is not the fixture authority.");
    }

    const connection = new Connection(
      process.env.SOLANA_RPC_URL ??
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
        deployment.rpcUrl,
      "confirmed",
    );
    const paymentMint = new PublicKey(deployment.payment.mint);
    const paymentTokenProgram = new PublicKey(deployment.payment.tokenProgram);
    const mintState = await getMint(
      connection,
      paymentMint,
      "confirmed",
      paymentTokenProgram,
    );
    if (!mintState.mintAuthority?.equals(payer.publicKey)) {
      throw new Error("The fixture authority cannot mint mock USDC.");
    }

    const recipientPaymentAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      paymentMint,
      recipient,
      false,
      "confirmed",
      { commitment: "confirmed" },
      paymentTokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    if (recipientPaymentAccount.amount < TARGET_USDC_RAW) {
      await mintTo(
        connection,
        payer,
        paymentMint,
        recipientPaymentAccount.address,
        payer,
        TARGET_USDC_RAW - recipientPaymentAccount.amount,
        [],
        { commitment: "confirmed" },
        paymentTokenProgram,
      );
    }

    const solBalance = await connection.getBalance(recipient, "confirmed");
    if (solBalance < TARGET_SOL_LAMPORTS) {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient,
          lamports: TARGET_SOL_LAMPORTS - solBalance,
        }),
      );
      await sendAndConfirmTransaction(connection, transaction, [payer], {
        commitment: "confirmed",
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[Market Rips] devnet faucet failed", error);
    const message = error instanceof Error ? error.message : "Unknown faucet error";
    return Response.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? message
            : "Devnet funding failed.",
      },
      { status: 500 },
    );
  }
}
