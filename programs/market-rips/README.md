# Market Rips program

Anchor program for an inventory-backed, three-card stock pack using MagicBlock VRF and Ephemeral Rollups.

Program ID:

```text
Fu7hq2ZxsxDfmTFvMN6kxaZa6z5uB1ENKiH4Af2HwkbL
```

The current target is Solana devnet with mock USDC and mock Token-2022 stock mints. Real tokenized equities are intentionally outside the devnet milestone.

## Trust and execution split

| Layer | State and responsibility |
| --- | --- |
| Solana L1 | USDC payment, stock vaults, public pack inventory, purchases, VRF request/callback, inventory reservations, refunds and prize claims |
| MagicBlock ER | Only the temporary `PackSession` card-reveal state |
| MagicBlock VRF | Verifiable random bytes and a scoped, program-specific callback signer |
| Session Keys | Optional temporary signer for `reveal_card`; cannot buy, refund, administer or move tokens |

Inventory is selected and reserved in the VRF callback on L1. Shared pack inventory is not delegated to the ER. This prevents two concurrent pack sessions from independently spending the same stock inventory.

## PDA and token-account map

All integer seeds use little-endian bytes.

| Account | Derivation | Purpose |
| --- | --- | --- |
| `PlatformConfig` | `[b"platform"]` | Authority, payment mint/program, pause flag and total refundable payments |
| `PackConfig` | `[b"pack", platform, pack_id.to_le_bytes()]` | Price, timeout, prize definitions, available/reserved/claimed counts and pending draws |
| `Purchase` | `[b"purchase", buyer, nonce.to_le_bytes()]` | Canonical payment and lifecycle record |
| `PackSession` | `[b"session", purchase]` | VRF result, reveal mask and claim mask; this is the only account delegated to MagicBlock |
| Payment vault | ATA of `PlatformConfig` for the payment mint | Holds purchase payments and refundable funds |
| Prize vault | ATA of `PackConfig` for each stock mint | Holds inventory backing a prize entry |
| Buyer stock account | ATA of buyer for the selected stock mint | Receives a claimed prize |

The `#[delegate]` macro adds these MagicBlock accounts to `delegate_pack_session`:

- `buffer_pack_session`
- `delegation_record_pack_session`
- `delegation_metadata_pack_session`
- `owner_program`
- `delegation_program`
- `system_program`

Their addresses and PDA rules are emitted in `target/idl/market_rips.json`; clients should derive them from the IDL or `@magicblock-labs/ephemeral-rollups-sdk`, not hard-code them.

## Instructions

### Administration and inventory

`initialize_platform(fee_bps)`

- Creates `PlatformConfig` and its payment ATA.
- Stores the authority, payment mint and token program.
- `fee_bps` is stored for future pricing/accounting; the current contract treats the full pack payment as locked until settlement.

`update_platform(new_authority, fee_bps, paused)`

- Rotates authority, updates the configured fee, or pauses purchases.
- Limited to the current platform authority.

`create_pack(pack_id, price, reveal_timeout_seconds)`

- Creates a disabled pack with room for eight stock entries.
- `reveal_timeout_seconds` must be at least 60 seconds.

`add_prize_entry(raw_amount_per_pull, units)`

- Adds a unique stock mint to a disabled pack.
- Atomically transfers `raw_amount_per_pull * units` into the pack's prize vault.
- Supports legacy SPL Token and Token-2022 through `TokenInterface`.

`restock_prize_entry(entry_index, units)`

- Transfers additional backed inventory into an existing prize vault.
- Increases only the selected entry's available-unit count.

`set_pack_enabled(enabled)`

- Enables sales after at least three entries and three available units exist.

`withdraw_proceeds(amount)`

- Transfers only unlocked payment tokens to the authority.
- Cannot withdraw `PlatformConfig.locked_payments`, which backs purchases that can still be refunded.

### Purchase and MagicBlock VRF

`buy_pack(nonce)`

- Transfers the pack price from the buyer into the platform payment vault.
- Creates `Purchase` and `PackSession` PDAs.
- Adds three pending inventory draws.
- Rejects sales unless current unreserved inventory covers all existing pending draws plus the new pack.

`request_pack_randomness(client_seed)`

- Runs on Solana L1.
- Changes `Purchase` from `Paid` to `RandomnessPending`.
- CPIs into MagicBlock VRF with `create_request_scoped_randomness_ix`.
- Names `consume_pack_randomness` as the callback.
- A client-selected seed is domain input, not the source of randomness.

`consume_pack_randomness(randomness)`

- Called only by MagicBlock's scoped VRF identity signer; the `#[vrf_callback]` macro enforces this.
- Expands the verified 32-byte result into three unbiased inventory tickets.
- Atomically moves three units from `available_units` to `reserved_units`.
- Writes the three selected entry indexes into `PackSession`.
- Changes `Purchase` to `ResultReady`.

MagicBlock VRF constants currently emitted by the IDL:

```text
VRF program:      Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz
Solana L1 queue:  Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh
Slot hashes:      SysvarS1otHashes111111111111111111111111111
```

This program deliberately uses the L1 queue, not `DEFAULT_EPHEMERAL_QUEUE`, because the callback mutates shared inventory. The ER is introduced after reservation.

### MagicBlock Ephemeral Rollup reveal

`delegate_pack_session(purchase)`

- Called on Solana after VRF fulfillment.
- Verifies the wallet owns the purchase.
- Delegates only the `PackSession` PDA.
- An optional validator identity may be supplied as the first remaining account; otherwise the default routing configuration is used.

`reveal_card(slot)`

- Runs against the MagicBlock ER RPC after delegation.
- Accepts slots `0`, `1`, and `2` once each.
- May be signed by the buyer wallet or by a valid `SessionTokenV2` temporary signer.
- Sets `completed = true` when all three bits in `revealed_mask` are present.

`commit_pack_session()`

- Runs on the ER.
- Commits an intermediate reveal state to Solana but leaves the account delegated.

`undelegate_pack_session()`

- Runs on the ER after all three cards are revealed.
- Commits the final state and returns account ownership to this program on Solana.
- Must finish before prizes can be claimed on L1.

MagicBlock devnet RPCs:

```text
Solana devnet:  https://api.devnet.solana.com
Magic Router:   https://devnet-router.magicblock.app
Ephemeral RPC:  https://devnet.magicblock.app
Ephemeral WS:   wss://devnet.magicblock.app
```

### Claims and recovery

`claim_prize(slot)`

- Runs on Solana after the session is committed and undelegated.
- Validates the selected entry's mint and token program.
- Transfers one raw prize amount from the pack vault to the buyer ATA.
- Is permissionless: anyone may pay transaction/ATA rent, but the destination is forced to the purchase buyer.
- Unlocks the pack payment as platform proceeds after all three prizes are claimed.

`refund_expired()`

- Returns the full payment if VRF has not successfully produced a result before expiry.
- Is permissionless: any relayer may submit it, but the destination is forced to the original buyer's payment-token account.
- Releases the three pending draws.
- Cannot refund after inventory has been reserved; those results remain permissionlessly claimable.

`process_undelegation`

- Generated by MagicBlock's `#[ephemeral]` macro.
- Infrastructure callback; application clients should not call it manually.

## Purchase state machine

```text
Paid
 ├─ request_pack_randomness ─> RandomnessPending
 │                              ├─ VRF callback ─> ResultReady
 │                              │                    └─ 3 claims ─> Settled
 │                              └─ expiry ─> Refunded
 └─ expiry ─> Refunded
```

Reveal progress is held separately in `PackSession`:

```text
vrf_fulfilled -> delegated -> reveal 0/1/2 -> completed -> committed/undelegated
```

## Build and test

```bash
cd web
cargo fmt --all -- --check
anchor build
cargo test -p market-rips --lib
```

The generated IDL and deployable binary are:

```text
target/idl/market_rips.json
target/deploy/market_rips.so
```

## Devnet deployment

The program is live on Solana devnet:

```text
Program:      Fu7hq2ZxsxDfmTFvMN6kxaZa6z5uB1ENKiH4Af2HwkbL
ProgramData:  4ZwC44Q5o3XSvaoshSfgYn2Not9KQy8wo8BGv51MB997
Final slot:   526241453
```

[Open the program in Solana Explorer](https://explorer.solana.com/address/Fu7hq2ZxsxDfmTFvMN6kxaZa6z5uB1ENKiH4Af2HwkbL?cluster=devnet).

Final upgrade transaction:

```text
52zSehGWQxdm5yScsdtrzrLPuXhMX9GLZwKiT7LJvkoK7b2K4n1Y5fPf8t9YQpPeC3Q1yyFCcGZhCTV3jc7XwJj
```

The ignored deploy keypair in `target/deploy/market_rips-keypair.json` matches the declared program ID.

```bash
cd web
solana config set --url devnet
solana airdrop 5
anchor build
anchor deploy --provider.cluster devnet
```

The final Anchor `1.1.2` artifact is active. Its local SHA-256 and the matching executable prefix downloaded from ProgramData are both:

```text
6291b6c1a840dee66f5a4e53acf222bb0586330b66ecf36f120f1bd2f2d4bf9d
```

Anchor created the optional on-chain IDL metadata account during the first deployment, but the CLI's transaction planner failed to replace it with the final schema. Treat `target/idl/market_rips.json` as canonical; do not generate the client from fetched on-chain metadata until that Anchor tooling issue is resolved.

## Live devnet fixture

The devnet fixture is initialized, inventory-backed, and enabled. These are mock assets with no financial value.

| Account | Address |
| --- | --- |
| Authority | `2eDJJZydDTV4HQmbtX6YwhrdfCW7XU3zms9538HGqkuB` |
| Platform PDA | `6WbYFDtqnDvHNTqvasAY1tRC66NEFeAbAZZp1HPFmNdn` |
| Pack PDA | `8DK1epX4kwZFrkooZfSqhvHTDqzWSg5E4TrfpNFZbrkU` |
| Mock USDC mint | `Aqy2cmU8LCfvpi18nCJp6fZ7qAunurK3ainH5jtdm2ze` |
| Mock TSLA mint | `Bnop3mafZTSCkfg2Utzai5oUvpVvcNxD1PiDmKzDmD8` |
| Mock NVDA mint | `KSBTePinmNrAF2bisAcbyB5VaDuwcibMMpi62HnPV6L` |
| Mock GME mint | `7Rj9y4oafH32PuYmGRcgyfiFhFKnPaggAg28H5XhjAip` |

The mock USDC mint uses the legacy SPL Token program. All three mock stock mints use Token-2022. The pack costs 10 mock USDC and each result transfers one whole mock stock unit in six-decimal raw amounts.

Copy the environment template if custom endpoints or a different wallet path are required, then run:

```bash
cd web
bun install
bun run chain:bootstrap
bun run chain:e2e
```

`chain:bootstrap` is resumable: it reuses `deployments/devnet.json` and only creates missing configuration. `chain:e2e` executes and verifies the complete sequence:

```text
buy -> VRF request/callback -> delegate -> reveal 0/1/2
    -> commit and undelegate -> claim 0/1/2 -> Settled
```

The current fixture is recorded in `deployments/devnet.json`. The most recent transaction evidence is overwritten in `deployments/devnet-last-run.json` after a fully successful run.

The latest verified run settled purchase `C1idcVtUPVuiZX8TfHtdYNDF6PBSSwQAefPdeqbUGThZ` with GME, NVDA and GME. Its MagicBlock callback was transaction `3Kvbxr2vYtB2M2kyQxo9zsycdhN6md2KgpDUXSU9qmDBrS6Kw2SpNVazvNSxGW3eG67VUwW4MRqKowC2jWqigb6z`.

[Open the verified VRF callback in Solana Explorer](https://explorer.solana.com/tx/3Kvbxr2vYtB2M2kyQxo9zsycdhN6md2KgpDUXSU9qmDBrS6Kw2SpNVazvNSxGW3eG67VUwW4MRqKowC2jWqigb6z?cluster=devnet).

## Current limitations

- VRF results are publicly readable on L1 before the visual reveal. A later version can use a Private Ephemeral Rollup or a reveal commitment if cryptographic secrecy is required.
- `claim_prize` supports standard Token/Token-2022 transfers. If a future real stock mint uses a transfer-hook extension, the instruction must accept and forward the hook's extra accounts.
- No oracle is needed for settlement because every pack pays fixed raw token amounts from pre-funded inventory. Live stock prices belong in a later scoring/display layer, not the pack's solvency path.
- Session-token creation is a client operation against the Session Keys program. This contract only validates the optional `SessionTokenV2` account during reveal/commit/undelegate.
