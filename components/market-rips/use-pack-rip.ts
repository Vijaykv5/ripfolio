"use client";

import { useCallback, useRef, useState } from "react";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  Connection,
  Transaction,
  type BlockhashWithExpiryBlockHeight,
  type SendOptions,
} from "@solana/web3.js";
import {
  assertPackCanBePurchased,
  buildBuyAndRandomnessTransaction,
  buildClaimTransaction,
  buildDelegateTransaction,
  buildRevealTransaction,
  createMarketRipsPrograms,
  createPackAddresses,
  describeProgramError,
  rewardsFromSession,
  waitForDelegation,
  waitForRandomness,
  waitForUndelegation,
  type PackAddresses,
  type PackReward,
  type PackErrorKind,
  type PackSessionState,
} from "@/lib/market-rips/client";
import type { RipState } from "./pack-stage";

export type PackFlowStatus =
  | "idle"
  | "checking"
  | "funding"
  | "signing"
  | "confirming"
  | "randomness"
  | "delegating"
  | "ripping"
  | "settling"
  | "complete"
  | "error";

export const PACK_STATUS_COPY: Record<PackFlowStatus, string> = {
  idle: "Ready · Devnet",
  checking: "Checking pack...",
  funding: "Adding devnet test funds...",
  signing: "Approve in your wallet",
  confirming: "Confirming purchase...",
  randomness: "Drawing with MagicBlock VRF...",
  delegating: "Preparing the reveal...",
  ripping: "Opening on MagicBlock...",
  settling: "Sending rewards to your wallet...",
  complete: "Rewards received",
  error: "",
};

type PreparedTransaction = {
  connection: Connection;
  latestBlockhash: BlockhashWithExpiryBlockHeight;
  options?: SendOptions;
  transaction: Transaction;
};

type PendingPack = {
  addresses: PackAddresses;
  selectedSession?: PackSessionState;
};

export function usePackRip() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { publicKey, signAllTransactions, signTransaction } = useWallet();
  const [flowStatus, setFlowStatus] = useState<PackFlowStatus>("idle");
  const [ripState, setRipState] = useState<RipState>("sealed");
  const [rewards, setRewards] = useState<PackReward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [retryAllowed, setRetryAllowed] = useState(true);
  const [errorKind, setErrorKind] = useState<PackErrorKind | null>(null);
  const paymentSubmittedRef = useRef(false);
  const pendingPackRef = useRef<PendingPack | null>(null);

  const prepareTransaction = useCallback(
    async (
      transaction: Transaction,
      targetConnection: Connection,
      options?: SendOptions,
    ): Promise<PreparedTransaction> => {
      if (!publicKey) throw new Error("Connect your wallet first.");
      const latestBlockhash = await targetConnection.getLatestBlockhash("confirmed");
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = latestBlockhash.blockhash;
      return {
        connection: targetConnection,
        latestBlockhash,
        options,
        transaction,
      };
    },
    [publicKey],
  );

  const submitPreparedTransaction = useCallback(
    async (
      prepared: PreparedTransaction,
      signedTransaction: Transaction,
      onSubmitted?: () => void,
    ): Promise<string> => {
      const signature = await prepared.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          preflightCommitment: "confirmed",
          ...prepared.options,
        },
      );
      onSubmitted?.();
      const confirmation = await prepared.connection.confirmTransaction(
        { signature, ...prepared.latestBlockhash },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      setLastSignature(signature);
      return signature;
    },
    [],
  );

  const sendAndConfirm = useCallback(
    async (
      transaction: Transaction,
      targetConnection: Connection,
      options?: SendOptions,
      onSubmitted?: () => void,
    ): Promise<string> => {
      if (!publicKey) throw new Error("Connect your wallet first.");
      if (!signTransaction) {
        throw new Error("This wallet does not support transaction signing.");
      }
      const prepared = await prepareTransaction(
        transaction,
        targetConnection,
        options,
      );
      const signedTransaction = await signTransaction(prepared.transaction);
      return submitPreparedTransaction(prepared, signedTransaction, onSubmitted);
    },
    [prepareTransaction, publicKey, signTransaction, submitPreparedTransaction],
  );

  const ripPack = useCallback(async () => {
    if (!anchorWallet || !publicKey) return;

    setError(null);
    setErrorKind(null);
    setRewards([]);
    setRipState("sealed");
    setFlowStatus("checking");
    setLastSignature(null);
    setRetryAllowed(true);
    paymentSubmittedRef.current = false;

    try {
      const { baseProgram, erProgram, erConnection } = createMarketRipsPrograms(
        connection,
        anchorWallet,
      );
      let pendingPack = pendingPackRef.current;

      if (!pendingPack) {
        try {
          await assertPackCanBePurchased(connection, publicKey);
        } catch (fundingError) {
          const details = describeProgramError(fundingError);
          if (!["payment-funds", "sol-funds"].includes(details.kind)) {
            throw fundingError;
          }

          setFlowStatus("funding");
          const response = await fetch("/api/devnet/fund", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ wallet: publicKey.toBase58() }),
          });
          const result = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(result.error ?? "Devnet funding failed.");
          }
          await assertPackCanBePurchased(connection, publicKey);
        }

        const addresses = createPackAddresses(publicKey);
        const purchaseTransaction = await buildBuyAndRandomnessTransaction(
          baseProgram,
          publicKey,
          addresses,
        );
        setFlowStatus("signing");
        await sendAndConfirm(
          purchaseTransaction,
          connection,
          undefined,
          () => {
            pendingPackRef.current = { addresses };
            paymentSubmittedRef.current = true;
            setFlowStatus("confirming");
          },
        );
        pendingPack = pendingPackRef.current;
      }

      if (!pendingPack) {
        throw new Error("The pack purchase could not be resumed.");
      }

      paymentSubmittedRef.current = true;
      setFlowStatus("randomness");
      const selectedSession =
        pendingPack.selectedSession ??
        (await waitForRandomness(baseProgram, pendingPack.addresses));
      pendingPack.selectedSession = selectedSession;

      const delegateTransaction = await buildDelegateTransaction(
        baseProgram,
        publicKey,
        pendingPack.addresses,
      );
      const revealTransaction = await buildRevealTransaction(
        erProgram,
        publicKey,
        pendingPack.addresses.packSession,
      );
      const claimTransaction = await buildClaimTransaction(
        baseProgram,
        publicKey,
        pendingPack.addresses,
        selectedSession,
      );
      const preparedTransactions = await Promise.all([
        prepareTransaction(delegateTransaction, connection),
        prepareTransaction(revealTransaction, erConnection, {
          skipPreflight: true,
        }),
        prepareTransaction(claimTransaction, connection),
      ]);
      if (!signAllTransactions) {
        throw new Error("This wallet does not support batch signing.");
      }

      setFlowStatus("signing");
      const signedTransactions = await signAllTransactions(
        preparedTransactions.map((prepared) => prepared.transaction),
      );

      setFlowStatus("delegating");
      await submitPreparedTransaction(
        preparedTransactions[0],
        signedTransactions[0],
      );
      await waitForDelegation(
        connection,
        erConnection,
        pendingPack.addresses.packSession,
      );

      setFlowStatus("ripping");
      await submitPreparedTransaction(
        preparedTransactions[1],
        signedTransactions[1],
      );
      const committedSession = await waitForUndelegation(
        connection,
        baseProgram,
        pendingPack.addresses.packSession,
      );

      setFlowStatus("settling");
      if (
        committedSession.selectedEntries.some(
          (entry, index) => entry !== selectedSession.selectedEntries[index],
        )
      ) {
        throw new Error("The settled rewards do not match the signed claim.");
      }
      await submitPreparedTransaction(
        preparedTransactions[2],
        signedTransactions[2],
      );

      setRewards(rewardsFromSession(selectedSession));
      setRipState("revealed");
      setFlowStatus("complete");
      setRetryAllowed(true);
      paymentSubmittedRef.current = false;
      pendingPackRef.current = null;
    } catch (caught) {
      const details = describeProgramError(caught);
      const pending = paymentSubmittedRef.current;
      if (details.kind === "rejected") {
        setError(null);
        setErrorKind(details.kind);
        setRetryAllowed(true);
        setRipState("sealed");
        setFlowStatus(pending ? "error" : "idle");
        return;
      }

      console.error("[Ripfolio] pack flow failed", caught);
      setError(
        pending ? "Pack paused. Try again." : details.message,
      );
      setErrorKind(details.kind);
      setRetryAllowed(details.retryable || pending);
      setRipState("sealed");
      setFlowStatus("error");
    }
  }, [
    anchorWallet,
    connection,
    prepareTransaction,
    publicKey,
    sendAndConfirm,
    signAllTransactions,
    submitPreparedTransaction,
  ]);

  function reset() {
    setError(null);
    setErrorKind(null);
    setRewards([]);
    setRipState("sealed");
    setFlowStatus("idle");
    setLastSignature(null);
    setRetryAllowed(true);
    paymentSubmittedRef.current = false;
  }

  return {
    error,
    errorKind,
    flowStatus,
    lastSignature,
    rewards,
    ripPack,
    ripState,
    retryAllowed,
    reset,
  };
}
