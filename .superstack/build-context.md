{
  "debug": {
    "issues_resolved": [
      {
        "error": "WalletSignTransactionError: Transaction cancelled during the MagicBlock reveal",
        "cause": "The pack flow requested separate wallet approvals for purchase, delegation, reveal, and claim, then treated a cancelled later approval as a non-retryable pending pack.",
        "fix": "Batch the post-VRF transactions into one wallet approval and keep the paid pack resumable when that approval is cancelled."
      }
    ],
    "last_debug_session": "2026-11-27T12:58:02+05:30"
  },
  "defi": {
    "protocol_type": "custom",
    "program_id": "Fu7hq2ZxsxDfmTFvMN6kxaZa6z5uB1ENKiH4Af2HwkbL",
    "security_review": "none",
    "oracle_integration": "planned: Pyth xStock/USD feeds with freshness and confidence checks",
    "emergency_pause": true
  }
}
