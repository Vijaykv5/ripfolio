# Market Rips

Market Rips is a Solana pack-opening game. A user connects a wallet, buys a themed stock pack with USDC, reveals the pack through a fast scratch/rip interaction, and receives fractional tokenized stocks in the same wallet.

The initial version should use mock Token-2022 stock mints on devnet. Real xStocks should only be added after checking mint extensions, liquidity, issuer integration rules, and the jurisdictions where the product may operate.

## Recommended MVP

Start with one pack:

- Pack price: 10 devnet USDC
- Contents: three mock tokenized stocks
- Theme: AI and technology
- Inventory: pre-funded before the pack is sold
- Randomness: MagicBlock VRF
- Reveal UX: MagicBlock Ephemeral Rollup and a bounded session key
- Settlement: the Anchor program transfers the three stock tokens on Solana
- Post-rip game: a points-only portfolio race using live prices

Avoid jackpots and cash leaderboards in the MVP. They add significant gambling, securities-distribution, treasury, and oracle risk before the basic experience has been validated.

## User flow

1. The user connects a Solana wallet.
2. The app checks the network and displays the pack price, fee, remaining inventory, possible stocks, and current odds.
3. The user approves one `buy_pack` transaction and pays USDC.
4. The program creates a `Purchase` account on Solana and a `PackSession` account for the reveal.
5. MagicBlock VRF runs on Solana L1; its verified callback selects and reserves three backed prizes.
6. The `PackSession` is then delegated to a MagicBlock Ephemeral Rollup.
7. A narrowly scoped session key lets the user scratch or tear the pack without approving every reveal action.
8. When the reveal finishes, the session state is committed and undelegated back to Solana.
9. Three `claim_prize` instructions transfer the selected Token-2022 stock amounts from program vaults to the user's associated token accounts.
10. If randomness or settlement never completes, `refund_expired` returns the user's payment after a defined timeout.

## Architecture

```text
Next.js app
  ├── Wallet Standard connection
  ├── Pack store and inventory display
  ├── Scratch/rip animation
  └── Transaction and settlement status
           │
           ▼
Anchor program on Solana
  ├── Pack configuration and public odds
  ├── USDC payment vault
  ├── Token-2022 stock inventory vaults
  ├── Purchase and refund state
  └── Final token settlement
           │
           ▼
MagicBlock
  ├── VRF request and verified callback
  ├── Delegated PackSession state
  ├── Session-key reveal actions
  └── Real-time price feeds for portfolio races
```

Keep USDC and stock inventory on Solana. Only delegate temporary interaction state to MagicBlock. This keeps the prize assets in the canonical L1 vaults while still giving the reveal Web2-like responsiveness.

## Why an Anchor program is required

A frontend-only prototype can demonstrate the animation, but a real pack needs a program. Otherwise the user must trust a server to choose outcomes, maintain inventory, and pay winners.

The program should enforce:

- The pack price and fee
- The list of allowed stock mints
- Public pack inventory and live odds
- One verified outcome per purchase
- MagicBlock VRF callback authority
- Reservation of inventory before settlement
- Exactly-once settlement
- Permissionless refunds after expiry
- Admin actions that cannot rewrite an existing purchase

## Program accounts

### `PlatformConfig`

One global PDA.

```text
seeds: ["platform"]
authority
treasury
fee_bps
paused
```

### `PackConfig`

One PDA per pack type.

```text
seeds: ["pack", platform, pack_id_le]
pack_id
price
reveal_timeout_seconds
entry_count
pending_draws
enabled
entries[8] {
  stock_mint
  token_program
  raw_amount_per_pull
  available_units
  reserved_units
  claimed_units
}
```

Each configured stock mint has an associated token account owned by `PackConfig`. The vault must contain enough tokens to back its available and reserved units.

### `Purchase`

Canonical payment and settlement record on Solana.

```text
seeds: ["purchase", buyer, purchase_nonce]
buyer
pack_config
amount_paid
created_at
expires_at
status
```

Suggested status values:

```text
Paid -> RandomnessPending -> ResultReady -> Settled
  └──────────────────────────────────────> Refunded
```

### `PackSession`

Temporary reveal state delegated to MagicBlock.

```text
purchase
buyer
selected_entries[3]
revealed_mask
claimed_mask
vrf_fulfilled
completed
```

Do not put treasury authority or unrestricted transfer authority in the session account.

## Program instructions

```text
initialize_platform
update_platform
create_pack
add_prize_entry
restock_prize_entry
set_pack_enabled
buy_pack
request_pack_randomness
consume_pack_randomness
delegate_pack_session
reveal_card
commit_pack_session
undelegate_pack_session
claim_prize
refund_expired
withdraw_proceeds
```

Admin instructions configure future packs. They must not be able to change the price, prize table, or result of an already-created `Purchase`.

## Inventory and odds

Use a limited, inventory-backed batch instead of an unlimited weighted lottery.

For example:

```text
30 packs total
30 AAPLx-sized prize units
30 NVDAx-sized prize units
30 TSLAx-sized prize units
```

Every pack consumes three units. The program samples from the remaining entries and decrements inventory in the verified VRF callback. `buy_pack` must reject new purchases when the unreserved inventory cannot cover all pending purchases.

This gives the app three useful guarantees:

- Every advertised result is already backed by tokens.
- Remaining inventory and current odds are public.
- A valid purchase cannot become insolvent while waiting for its reveal.

For the first implementation, keep every pack approximately equal in marked value. Store and transfer raw Token-2022 amounts. Calculate human-readable/scaled balances in the UI because stock tokens may use the Token-2022 Scaled UI extension.

## MagicBlock integration

### VRF

`buy_pack` creates the purchase, but it must not accept client-provided randomness. The program requests randomness from MagicBlock on Solana L1 and names `consume_pack_randomness` as the callback.

The callback must:

1. Verify MagicBlock's VRF program identity signer.
2. Reject a second callback for the same purchase.
3. Convert the random bytes to unbiased indices using rejection sampling rather than a naïve modulo when the range does not evenly divide the random domain.
4. Select only entries with remaining inventory.
5. Reserve/decrement all three selected entries atomically.
6. Store a commitment to the result in the L1 `Purchase` account when the session is committed.

Use MagicBlock's Solana L1 VRF queue for selection and reservation. Delegate only `PackSession` after the callback succeeds; shared inventory stays on L1. See [the program runbook](programs/market-rips/README.md) for the exact queue, program IDs and account flow.

### Ephemeral Rollup

Delegate only `PackSession`. The visual reveal can then submit `reveal_card` instructions with low latency. When all cards are revealed, commit and undelegate the session before L1 settlement.

### Session key

The wallet should approve a temporary key that can only:

- Call `reveal_card`
- Act on one specific `PackSession`
- Expire after a few minutes
- Never transfer USDC or stock tokens
- Never call an admin or settlement instruction

The user still signs `buy_pack`; the session key only removes repeated approvals during the animation. The current Session Keys integration scopes authorization to this program and buyer; the only instructions accepting it are reveal/commit/undelegate, none of which can move tokens.

## Project layout

Keep the Anchor workspace in this repository alongside the Next.js app:

```text
web/
├── app/                       # Next.js application
├── components/
│   ├── wallet/
│   ├── packs/
│   └── reveal/
├── lib/
│   ├── solana/
│   ├── magicblock/
│   └── formatting/
├── programs/
│   └── market-rips/           # Anchor program
├── tests/
│   └── market-rips.ts
├── Anchor.toml
└── package.json
```

## Build milestones

### 1. Frontend simulation

- Add Wallet Standard connection on devnet.
- Build the pack store and scratch/rip interaction using hard-coded outcomes.
- Model all loading, rejected, failed, refunded, and settled states.
- Verify the experience works on mobile before touching the program.

Deliverable: a user can connect a wallet and complete a simulated pack opening.

### 2. Local Anchor settlement

- Initialize the Anchor workspace.
- Create mock USDC and three mock Token-2022 stock mints.
- Implement `PlatformConfig`, `PackConfig`, `PrizeEntry`, and `Purchase`.
- Implement payment, vault funding, deterministic test settlement, and refunds.
- Test on a local validator.

Deliverable: a paid local purchase transfers three mock stock tokens exactly once.

### 3. MagicBlock VRF

- Add `PackSession` and the VRF request/callback.
- Verify the VRF signer in the callback.
- Reserve three inventory entries atomically.
- Test duplicate callbacks, empty inventory, and abandoned purchases.

Deliverable: devnet randomness determines a fully backed pack result.

### 4. Ephemeral reveal session

- Delegate `PackSession` to a MagicBlock Ephemeral Rollup.
- Add the bounded session key.
- Submit each reveal as a real program instruction.
- Commit the completed result back to Solana.

Deliverable: the user signs once and reveals all cards with no additional wallet popups.

### 5. End-to-end devnet MVP

- Replace simulated frontend data with program accounts.
- Add transaction simulation, confirmation, retry, and explorer links.
- Add the points-only portfolio race.
- Run adversarial tests and test on at least two wallets.

Deliverable: wallet connect through pack settlement works on devnet.

## Local environment

The current machine already satisfies the toolchain requirements:

```text
Node.js 24.10.0
Bun 1.3.14
Rust 1.96.0
Solana CLI 3.1.10
Anchor CLI 1.1.2
```

Run the existing frontend:

```bash
cd web
bun install
bun dev
```

Build and test the Anchor workspace:

```bash
anchor build
cargo test -p market-rips --lib
```

The program is deployed on devnet at `Fu7hq2ZxsxDfmTFvMN6kxaZa6z5uB1ENKiH4Af2HwkbL`. Exact accounts, MagicBlock constants, instruction behavior, deployment status, and client ordering are documented in [`programs/market-rips/README.md`](programs/market-rips/README.md).

The live mock fixture and full MagicBlock integration test can be run with:

```bash
bun run chain:bootstrap
bun run chain:e2e
```

The bootstrap is resumable. The end-to-end command verifies buy, MagicBlock VRF fulfillment, PackSession delegation, all three ER reveals, commit/undelegation, all three L1 claims, exact token balance changes, and the final `Settled` state. Public fixture addresses are in [`deployments/devnet.json`](deployments/devnet.json), and the latest successful transaction report is in [`deployments/devnet-last-run.json`](deployments/devnet-last-run.json).

Use mock tokens and MagicBlock/Solana devnet for integration testing. Do not use real stock tokens or mainnet funds until settlement, refund, inventory, and callback-replay tests pass.

## Tests that must exist before mainnet

- A purchase cannot settle twice.
- A VRF callback cannot be replayed or forged.
- A pack cannot sell without enough reserved inventory.
- A result cannot reference a mint outside its pack configuration.
- A user cannot settle another user's purchase to a substituted token account.
- Admin changes cannot modify an existing purchase.
- Integer multiplication cannot overflow when validating vault backing.
- A stale purchase can be refunded exactly once.
- Settlement remains correct when a Token-2022 mint uses scaled display amounts.
- A compromised session key cannot move tokens or affect another session.

## Mainnet gate

Before enabling real xStocks:

1. Confirm the exact supported Solana mint addresses with the issuer.
2. Inspect every Token-2022 extension used by those mints.
3. Confirm whether transfers to and from program-owned vaults are supported.
4. Add jurisdiction gating and the required product disclosures.
5. Obtain legal review for randomized distribution of tokenized financial products.
6. Complete an independent Anchor security review.

The mainnet product should never describe tracker certificates as direct shareholder ownership unless the chosen issuer's legal terms explicitly provide that ownership.
