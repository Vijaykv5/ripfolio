use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use ephemeral_rollups_sdk::{
    anchor::{commit, delegate, ephemeral, vrf, vrf_callback},
    cpi::DelegateConfig,
    ephem::MagicIntentBundleBuilder,
    vrf::{
        instructions::{create_request_scoped_randomness_ix, RequestRandomnessParams},
        types::SerializableAccountMeta,
    },
};
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

declare_id!("Fu7hq2ZxsxDfmTFvMN6kxaZa6z5uB1ENKiH4Af2HwkbL");

pub const PLATFORM_SEED: &[u8] = b"platform";
pub const PACK_SEED: &[u8] = b"pack";
pub const PURCHASE_SEED: &[u8] = b"purchase";
pub const SESSION_SEED: &[u8] = b"session";
pub const MAX_PRIZE_ENTRIES: usize = 8;
pub const PULLS_PER_PACK: usize = 3;
pub const ALL_CARDS_MASK: u8 = (1 << PULLS_PER_PACK) - 1;
pub const UNSET_ENTRY: u8 = u8::MAX;

#[ephemeral]
#[program]
pub mod market_rips {
    use super::*;

    pub fn initialize_platform(ctx: Context<InitializePlatform>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 2_000, MarketRipsError::FeeTooHigh);

        let platform = &mut ctx.accounts.platform;
        platform.authority = ctx.accounts.authority.key();
        platform.payment_mint = ctx.accounts.payment_mint.key();
        platform.payment_token_program = ctx.accounts.payment_token_program.key();
        platform.locked_payments = 0;
        platform.fee_bps = fee_bps;
        platform.paused = false;
        platform.bump = ctx.bumps.platform;

        emit!(PlatformInitialized {
            platform: platform.key(),
            authority: platform.authority,
            payment_mint: platform.payment_mint,
        });
        Ok(())
    }

    pub fn update_platform(
        ctx: Context<UpdatePlatform>,
        new_authority: Option<Pubkey>,
        fee_bps: Option<u16>,
        paused: Option<bool>,
    ) -> Result<()> {
        let platform = &mut ctx.accounts.platform;

        if let Some(new_authority) = new_authority {
            require!(
                new_authority != Pubkey::default(),
                MarketRipsError::InvalidAuthority
            );
            platform.authority = new_authority;
        }
        if let Some(fee_bps) = fee_bps {
            require!(fee_bps <= 2_000, MarketRipsError::FeeTooHigh);
            platform.fee_bps = fee_bps;
        }
        if let Some(paused) = paused {
            platform.paused = paused;
        }
        Ok(())
    }

    pub fn create_pack(
        ctx: Context<CreatePack>,
        pack_id: u64,
        price: u64,
        reveal_timeout_seconds: i64,
    ) -> Result<()> {
        require!(price > 0, MarketRipsError::InvalidPrice);
        require!(
            reveal_timeout_seconds >= 60,
            MarketRipsError::InvalidRevealTimeout
        );

        let pack = &mut ctx.accounts.pack;
        pack.platform = ctx.accounts.platform.key();
        pack.pack_id = pack_id;
        pack.price = price;
        pack.reveal_timeout_seconds = reveal_timeout_seconds;
        pack.entry_count = 0;
        pack.pending_draws = 0;
        pack.enabled = false;
        pack.bump = ctx.bumps.pack;
        pack.entries = [PrizeDefinition::default(); MAX_PRIZE_ENTRIES];

        emit!(PackCreated {
            pack: pack.key(),
            pack_id,
            price,
        });
        Ok(())
    }

    pub fn add_prize_entry(
        ctx: Context<AddPrizeEntry>,
        raw_amount_per_pull: u64,
        units: u32,
    ) -> Result<()> {
        require!(raw_amount_per_pull > 0, MarketRipsError::InvalidPrizeAmount);
        require!(units > 0, MarketRipsError::InvalidInventoryAmount);

        let pack = &mut ctx.accounts.pack;
        require!(!pack.enabled, MarketRipsError::DisablePackBeforeEditing);
        require!(
            (pack.entry_count as usize) < MAX_PRIZE_ENTRIES,
            MarketRipsError::TooManyPrizeEntries
        );
        require!(
            !pack.entries[..pack.entry_count as usize]
                .iter()
                .any(|entry| entry.mint == ctx.accounts.stock_mint.key()),
            MarketRipsError::DuplicatePrizeMint
        );

        let deposit_amount = raw_amount_per_pull
            .checked_mul(units as u64)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;

        transfer_tokens(
            &ctx.accounts.stock_token_program,
            &ctx.accounts.authority_stock_account,
            &ctx.accounts.prize_vault,
            &ctx.accounts.stock_mint,
            &ctx.accounts.authority.to_account_info(),
            deposit_amount,
            None,
        )?;

        let index = pack.entry_count as usize;
        pack.entries[index] = PrizeDefinition {
            mint: ctx.accounts.stock_mint.key(),
            token_program: ctx.accounts.stock_token_program.key(),
            raw_amount_per_pull,
            available_units: units,
            reserved_units: 0,
            claimed_units: 0,
            enabled: true,
        };
        pack.entry_count = pack
            .entry_count
            .checked_add(1)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;

        emit!(PrizeEntryAdded {
            pack: pack.key(),
            index: index as u8,
            mint: ctx.accounts.stock_mint.key(),
            units,
        });
        Ok(())
    }

    pub fn restock_prize_entry(
        ctx: Context<RestockPrizeEntry>,
        entry_index: u8,
        units: u32,
    ) -> Result<()> {
        require!(units > 0, MarketRipsError::InvalidInventoryAmount);

        let pack = &mut ctx.accounts.pack;
        let index = checked_entry_index(pack, entry_index)?;
        let entry = pack.entries[index];
        require_keys_eq!(
            entry.mint,
            ctx.accounts.stock_mint.key(),
            MarketRipsError::InvalidPrizeMint
        );
        require_keys_eq!(
            entry.token_program,
            ctx.accounts.stock_token_program.key(),
            MarketRipsError::InvalidTokenProgram
        );

        let deposit_amount = entry
            .raw_amount_per_pull
            .checked_mul(units as u64)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;

        transfer_tokens(
            &ctx.accounts.stock_token_program,
            &ctx.accounts.authority_stock_account,
            &ctx.accounts.prize_vault,
            &ctx.accounts.stock_mint,
            &ctx.accounts.authority.to_account_info(),
            deposit_amount,
            None,
        )?;

        pack.entries[index].available_units = pack.entries[index]
            .available_units
            .checked_add(units)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn set_pack_enabled(ctx: Context<SetPackEnabled>, enabled: bool) -> Result<()> {
        if enabled {
            require!(
                ctx.accounts.pack.entry_count >= PULLS_PER_PACK as u8,
                MarketRipsError::NotEnoughPrizeEntries
            );
            require!(
                total_available(&ctx.accounts.pack)? >= PULLS_PER_PACK as u64,
                MarketRipsError::InsufficientInventory
            );
        }
        ctx.accounts.pack.enabled = enabled;
        Ok(())
    }

    pub fn buy_pack(ctx: Context<BuyPack>, nonce: u64) -> Result<()> {
        let platform = &mut ctx.accounts.platform;
        let pack = &mut ctx.accounts.pack;

        require!(!platform.paused, MarketRipsError::PlatformPaused);
        require!(pack.enabled, MarketRipsError::PackDisabled);
        require!(
            pack.entry_count >= PULLS_PER_PACK as u8,
            MarketRipsError::NotEnoughPrizeEntries
        );

        let available = total_available(pack)?;
        let required = (pack.pending_draws as u64)
            .checked_add(PULLS_PER_PACK as u64)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        require!(
            available >= required,
            MarketRipsError::InsufficientInventory
        );

        transfer_tokens(
            &ctx.accounts.payment_token_program,
            &ctx.accounts.buyer_payment_account,
            &ctx.accounts.payment_vault,
            &ctx.accounts.payment_mint,
            &ctx.accounts.buyer.to_account_info(),
            pack.price,
            None,
        )?;

        let now = Clock::get()?.unix_timestamp;
        let purchase = &mut ctx.accounts.purchase;
        purchase.buyer = ctx.accounts.buyer.key();
        purchase.pack = pack.key();
        purchase.nonce = nonce;
        purchase.amount_paid = pack.price;
        purchase.created_at = now;
        purchase.expires_at = now
            .checked_add(pack.reveal_timeout_seconds)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        purchase.status = PurchaseStatus::Paid;
        purchase.bump = ctx.bumps.purchase;

        let session = &mut ctx.accounts.pack_session;
        session.purchase = purchase.key();
        session.buyer = ctx.accounts.buyer.key();
        session.selected_entries = [UNSET_ENTRY; PULLS_PER_PACK];
        session.revealed_mask = 0;
        session.claimed_mask = 0;
        session.vrf_fulfilled = false;
        session.completed = false;
        session.bump = ctx.bumps.pack_session;

        platform.locked_payments = platform
            .locked_payments
            .checked_add(pack.price)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        pack.pending_draws = pack
            .pending_draws
            .checked_add(PULLS_PER_PACK as u32)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;

        emit!(PackPurchased {
            purchase: purchase.key(),
            pack: pack.key(),
            buyer: purchase.buyer,
            amount: purchase.amount_paid,
        });
        Ok(())
    }

    /// Requests MagicBlock VRF on Solana L1. The callback also executes on L1,
    /// where it can safely reserve shared stock inventory before the per-user
    /// reveal session is delegated to an Ephemeral Rollup.
    pub fn request_pack_randomness(
        ctx: Context<RequestPackRandomness>,
        client_seed: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.purchase.status == PurchaseStatus::Paid,
            MarketRipsError::InvalidPurchaseStatus
        );
        require!(
            !ctx.accounts.pack_session.vrf_fulfilled,
            MarketRipsError::RandomnessAlreadyFulfilled
        );

        ctx.accounts.purchase.status = PurchaseStatus::RandomnessPending;

        let request = create_request_scoped_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.buyer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: ID,
            callback_discriminator: instruction::ConsumePackRandomness::DISCRIMINATOR.to_vec(),
            caller_seed: client_seed,
            accounts_metas: Some(vec![
                SerializableAccountMeta {
                    pubkey: ctx.accounts.pack.key(),
                    is_signer: false,
                    is_writable: true,
                },
                SerializableAccountMeta {
                    pubkey: ctx.accounts.purchase.key(),
                    is_signer: false,
                    is_writable: true,
                },
                SerializableAccountMeta {
                    pubkey: ctx.accounts.pack_session.key(),
                    is_signer: false,
                    is_writable: true,
                },
            ]),
            ..Default::default()
        });

        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.buyer.to_account_info(), &request)?;

        emit!(RandomnessRequested {
            purchase: ctx.accounts.purchase.key(),
            buyer: ctx.accounts.buyer.key(),
        });
        Ok(())
    }

    /// MagicBlock VRF callback. The `#[vrf_callback]` account macro validates
    /// the scoped VRF identity before this handler can run.
    pub fn consume_pack_randomness(
        ctx: Context<ConsumePackRandomness>,
        randomness: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.purchase.status == PurchaseStatus::RandomnessPending,
            MarketRipsError::InvalidPurchaseStatus
        );
        require!(
            !ctx.accounts.pack_session.vrf_fulfilled,
            MarketRipsError::RandomnessAlreadyFulfilled
        );

        select_and_reserve_prizes(
            &mut ctx.accounts.pack,
            &mut ctx.accounts.pack_session,
            &randomness,
        )?;

        ctx.accounts.purchase.status = PurchaseStatus::ResultReady;
        ctx.accounts.pack_session.vrf_fulfilled = true;

        emit!(RandomnessFulfilled {
            purchase: ctx.accounts.purchase.key(),
            selected_entries: ctx.accounts.pack_session.selected_entries,
        });
        Ok(())
    }

    /// Delegates only the per-purchase reveal state. Shared inventory, token
    /// vaults, payments and settlement always remain on Solana L1.
    pub fn delegate_pack_session(
        ctx: Context<DelegatePackSession>,
        purchase: Pubkey,
    ) -> Result<()> {
        let session = {
            let data = ctx.accounts.pack_session.try_borrow_data()?;
            PackSession::try_deserialize(&mut &data[..])?
        };
        require_keys_eq!(session.purchase, purchase, MarketRipsError::InvalidPurchase);
        require_keys_eq!(
            session.buyer,
            ctx.accounts.payer.key(),
            MarketRipsError::Unauthorized
        );
        require!(session.vrf_fulfilled, MarketRipsError::ResultNotReady);

        ctx.accounts.delegate_pack_session(
            &ctx.accounts.payer,
            &[SESSION_SEED, purchase.as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|account| account.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Executes on the Ephemeral Rollup. A wallet may sign directly, or a
    /// bounded SessionTokenV2 may authorize the temporary session signer.
    #[session_auth_or(
        ctx.accounts.pack_session.buyer == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn reveal_card(ctx: Context<RevealCard>, slot: u8) -> Result<()> {
        require!(
            (slot as usize) < PULLS_PER_PACK,
            MarketRipsError::InvalidCardSlot
        );
        let session = &mut ctx.accounts.pack_session;
        require!(session.vrf_fulfilled, MarketRipsError::ResultNotReady);

        let bit = 1u8 << slot;
        require!(
            session.revealed_mask & bit == 0,
            MarketRipsError::CardAlreadyRevealed
        );
        session.revealed_mask |= bit;
        session.completed = session.revealed_mask == ALL_CARDS_MASK;

        emit!(CardRevealed {
            purchase: session.purchase,
            slot,
            entry_index: session.selected_entries[slot as usize],
        });
        Ok(())
    }

    /// Commits an intermediate reveal state from the ER back to Solana.
    #[session_auth_or(
        ctx.accounts.pack_session.buyer == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn commit_pack_session(ctx: Context<CommitPackSession>) -> Result<()> {
        ctx.accounts.pack_session.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.pack_session.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Final reveal step: commit state and return PackSession ownership to this
    /// program on L1. Prize claims are valid only after this completes.
    #[session_auth_or(
        ctx.accounts.pack_session.buyer == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn undelegate_pack_session(ctx: Context<CommitPackSession>) -> Result<()> {
        require!(
            ctx.accounts.pack_session.completed,
            MarketRipsError::RevealNotComplete
        );
        ctx.accounts.pack_session.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.pack_session.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn claim_prize(ctx: Context<ClaimPrize>, slot: u8) -> Result<()> {
        require!(
            (slot as usize) < PULLS_PER_PACK,
            MarketRipsError::InvalidCardSlot
        );
        require!(
            ctx.accounts.purchase.status == PurchaseStatus::ResultReady,
            MarketRipsError::ResultNotReady
        );
        require!(
            ctx.accounts.pack_session.completed,
            MarketRipsError::RevealNotComplete
        );

        let bit = 1u8 << slot;
        require!(
            ctx.accounts.pack_session.claimed_mask & bit == 0,
            MarketRipsError::PrizeAlreadyClaimed
        );

        let entry_index = ctx.accounts.pack_session.selected_entries[slot as usize];
        let index = checked_entry_index(&ctx.accounts.pack, entry_index)?;
        let entry = ctx.accounts.pack.entries[index];

        require_keys_eq!(
            entry.mint,
            ctx.accounts.stock_mint.key(),
            MarketRipsError::InvalidPrizeMint
        );
        require_keys_eq!(
            entry.token_program,
            ctx.accounts.stock_token_program.key(),
            MarketRipsError::InvalidTokenProgram
        );
        require!(
            entry.reserved_units > 0,
            MarketRipsError::ReservationMissing
        );

        let pack_id_bytes = ctx.accounts.pack.pack_id.to_le_bytes();
        let platform_key = ctx.accounts.platform.key();
        let pack_signer_seeds: &[&[u8]] = &[
            PACK_SEED,
            platform_key.as_ref(),
            &pack_id_bytes,
            &[ctx.accounts.pack.bump],
        ];

        transfer_tokens(
            &ctx.accounts.stock_token_program,
            &ctx.accounts.prize_vault,
            &ctx.accounts.buyer_stock_account,
            &ctx.accounts.stock_mint,
            &ctx.accounts.pack.to_account_info(),
            entry.raw_amount_per_pull,
            Some(pack_signer_seeds),
        )?;

        ctx.accounts.pack.entries[index].reserved_units = ctx.accounts.pack.entries[index]
            .reserved_units
            .checked_sub(1)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        ctx.accounts.pack.entries[index].claimed_units = ctx.accounts.pack.entries[index]
            .claimed_units
            .checked_add(1)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        ctx.accounts.pack_session.claimed_mask |= bit;

        if ctx.accounts.pack_session.claimed_mask == ALL_CARDS_MASK {
            ctx.accounts.purchase.status = PurchaseStatus::Settled;
            ctx.accounts.platform.locked_payments = ctx
                .accounts
                .platform
                .locked_payments
                .checked_sub(ctx.accounts.purchase.amount_paid)
                .ok_or(MarketRipsError::ArithmeticOverflow)?;
        }

        emit!(PrizeClaimed {
            purchase: ctx.accounts.purchase.key(),
            slot,
            entry_index,
            mint: entry.mint,
            amount: entry.raw_amount_per_pull,
        });
        Ok(())
    }

    pub fn refund_expired(ctx: Context<RefundExpired>) -> Result<()> {
        require!(
            matches!(
                ctx.accounts.purchase.status,
                PurchaseStatus::Paid | PurchaseStatus::RandomnessPending
            ),
            MarketRipsError::PurchaseNotRefundable
        );
        require!(
            Clock::get()?.unix_timestamp >= ctx.accounts.purchase.expires_at,
            MarketRipsError::PurchaseNotExpired
        );

        ctx.accounts.pack.pending_draws = ctx
            .accounts
            .pack
            .pending_draws
            .checked_sub(PULLS_PER_PACK as u32)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        ctx.accounts.platform.locked_payments = ctx
            .accounts
            .platform
            .locked_payments
            .checked_sub(ctx.accounts.purchase.amount_paid)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        ctx.accounts.purchase.status = PurchaseStatus::Refunded;

        let signer_seeds: &[&[u8]] = &[PLATFORM_SEED, &[ctx.accounts.platform.bump]];
        transfer_tokens(
            &ctx.accounts.payment_token_program,
            &ctx.accounts.payment_vault,
            &ctx.accounts.buyer_payment_account,
            &ctx.accounts.payment_mint,
            &ctx.accounts.platform.to_account_info(),
            ctx.accounts.purchase.amount_paid,
            Some(signer_seeds),
        )?;

        emit!(PurchaseRefunded {
            purchase: ctx.accounts.purchase.key(),
            buyer: ctx.accounts.purchase.buyer,
            amount: ctx.accounts.purchase.amount_paid,
        });
        Ok(())
    }

    pub fn withdraw_proceeds(ctx: Context<WithdrawProceeds>, amount: u64) -> Result<()> {
        let unlocked = ctx
            .accounts
            .payment_vault
            .amount
            .checked_sub(ctx.accounts.platform.locked_payments)
            .ok_or(MarketRipsError::PaymentVaultInsolvent)?;
        require!(
            amount <= unlocked,
            MarketRipsError::WithdrawalExceedsProceeds
        );

        let signer_seeds: &[&[u8]] = &[PLATFORM_SEED, &[ctx.accounts.platform.bump]];
        transfer_tokens(
            &ctx.accounts.payment_token_program,
            &ctx.accounts.payment_vault,
            &ctx.accounts.authority_payment_account,
            &ctx.accounts.payment_mint,
            &ctx.accounts.platform.to_account_info(),
            amount,
            Some(signer_seeds),
        )
    }
}

fn transfer_tokens<'info>(
    token_program: &Interface<'info, TokenInterface>,
    from: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    authority: &AccountInfo<'info>,
    amount: u64,
    signer_seeds: Option<&[&[u8]]>,
) -> Result<()> {
    let accounts = TransferChecked {
        from: from.to_account_info(),
        mint: mint.to_account_info(),
        to: to.to_account_info(),
        authority: authority.clone(),
    };
    let cpi_context = CpiContext::new(token_program.key(), accounts);
    match signer_seeds {
        Some(seeds) => token_interface::transfer_checked(
            cpi_context.with_signer(&[seeds]),
            amount,
            mint.decimals,
        ),
        None => token_interface::transfer_checked(cpi_context, amount, mint.decimals),
    }
}

fn checked_entry_index(pack: &PackConfig, entry_index: u8) -> Result<usize> {
    let index = entry_index as usize;
    require!(
        index < pack.entry_count as usize,
        MarketRipsError::InvalidPrizeEntry
    );
    require!(
        pack.entries[index].enabled,
        MarketRipsError::PrizeEntryDisabled
    );
    Ok(index)
}

fn total_available(pack: &PackConfig) -> Result<u64> {
    pack.entries[..pack.entry_count as usize]
        .iter()
        .filter(|entry| entry.enabled)
        .try_fold(0u64, |total, entry| {
            total
                .checked_add(entry.available_units as u64)
                .ok_or(error!(MarketRipsError::ArithmeticOverflow))
        })
}

fn select_and_reserve_prizes(
    pack: &mut PackConfig,
    session: &mut PackSession,
    randomness: &[u8; 32],
) -> Result<()> {
    require!(
        pack.pending_draws >= PULLS_PER_PACK as u32,
        MarketRipsError::PendingDrawInvariant
    );

    for draw in 0..PULLS_PER_PACK {
        let available = total_available(pack)?;
        require!(available > 0, MarketRipsError::InsufficientInventory);
        let ticket = unbiased_ticket(randomness, draw as u8, available)?;

        let mut cursor = 0u64;
        let mut selected = None;
        for index in 0..pack.entry_count as usize {
            let entry = &pack.entries[index];
            if !entry.enabled || entry.available_units == 0 {
                continue;
            }
            let next = cursor
                .checked_add(entry.available_units as u64)
                .ok_or(MarketRipsError::ArithmeticOverflow)?;
            if ticket < next {
                selected = Some(index);
                break;
            }
            cursor = next;
        }

        let index = selected.ok_or(MarketRipsError::RandomSelectionFailed)?;
        pack.entries[index].available_units = pack.entries[index]
            .available_units
            .checked_sub(1)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        pack.entries[index].reserved_units = pack.entries[index]
            .reserved_units
            .checked_add(1)
            .ok_or(MarketRipsError::ArithmeticOverflow)?;
        session.selected_entries[draw] = index as u8;
    }

    pack.pending_draws = pack
        .pending_draws
        .checked_sub(PULLS_PER_PACK as u32)
        .ok_or(MarketRipsError::ArithmeticOverflow)?;
    Ok(())
}

/// Deterministically expands the VRF output into one independent u64 per draw
/// and rejects the tiny modulo-bias tail before mapping into the ticket range.
fn unbiased_ticket(randomness: &[u8; 32], draw: u8, total: u64) -> Result<u64> {
    require!(total > 0, MarketRipsError::InsufficientInventory);
    if total == 1 {
        return Ok(0);
    }

    for attempt in 0..16u8 {
        let domain = [draw, attempt];
        let digest = solana_sha256_hasher::hashv(&[
            b"market-rips-vrf-v1".as_slice(),
            randomness.as_slice(),
            domain.as_slice(),
        ]);
        let bytes = digest.to_bytes();
        let candidate = u64::from_le_bytes(
            bytes[..8]
                .try_into()
                .map_err(|_| error!(MarketRipsError::RandomSelectionFailed))?,
        );
        let limit = u64::MAX - (u64::MAX % total);
        if candidate < limit {
            return Ok(candidate % total);
        }
    }

    err!(MarketRipsError::RandomSelectionFailed)
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub payment_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [PLATFORM_SEED],
        bump
    )]
    pub platform: Box<Account<'info, PlatformConfig>>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = payment_mint,
        associated_token::authority = platform,
        associated_token::token_program = payment_token_program
    )]
    pub payment_vault: InterfaceAccount<'info, TokenAccount>,
    pub payment_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlatform<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform.bump, has_one = authority)]
    pub platform: Account<'info, PlatformConfig>,
}

#[derive(Accounts)]
#[instruction(pack_id: u64)]
pub struct CreatePack<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump, has_one = authority)]
    pub platform: Account<'info, PlatformConfig>,
    #[account(
        init,
        payer = authority,
        space = 8 + PackConfig::INIT_SPACE,
        seeds = [PACK_SEED, platform.key().as_ref(), &pack_id.to_le_bytes()],
        bump
    )]
    pub pack: Box<Account<'info, PackConfig>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddPrizeEntry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump, has_one = authority)]
    pub platform: Account<'info, PlatformConfig>,
    #[account(
        mut,
        seeds = [PACK_SEED, platform.key().as_ref(), &pack.pack_id.to_le_bytes()],
        bump = pack.bump,
        has_one = platform
    )]
    pub pack: Box<Account<'info, PackConfig>>,
    pub stock_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = stock_mint,
        token::authority = authority,
        token::token_program = stock_token_program
    )]
    pub authority_stock_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = stock_mint,
        associated_token::authority = pack,
        associated_token::token_program = stock_token_program
    )]
    pub prize_vault: InterfaceAccount<'info, TokenAccount>,
    pub stock_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RestockPrizeEntry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump, has_one = authority)]
    pub platform: Account<'info, PlatformConfig>,
    #[account(
        mut,
        seeds = [PACK_SEED, platform.key().as_ref(), &pack.pack_id.to_le_bytes()],
        bump = pack.bump,
        has_one = platform
    )]
    pub pack: Box<Account<'info, PackConfig>>,
    pub stock_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = stock_mint,
        token::authority = authority,
        token::token_program = stock_token_program
    )]
    pub authority_stock_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = stock_mint,
        associated_token::authority = pack,
        associated_token::token_program = stock_token_program
    )]
    pub prize_vault: InterfaceAccount<'info, TokenAccount>,
    pub stock_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct SetPackEnabled<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump, has_one = authority)]
    pub platform: Account<'info, PlatformConfig>,
    #[account(
        mut,
        seeds = [PACK_SEED, platform.key().as_ref(), &pack.pack_id.to_le_bytes()],
        bump = pack.bump,
        has_one = platform
    )]
    pub pack: Box<Account<'info, PackConfig>>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct BuyPack<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Box<Account<'info, PlatformConfig>>,
    #[account(
        mut,
        seeds = [PACK_SEED, platform.key().as_ref(), &pack.pack_id.to_le_bytes()],
        bump = pack.bump,
        has_one = platform
    )]
    pub pack: Box<Account<'info, PackConfig>>,
    #[account(address = platform.payment_mint)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = buyer,
        token::token_program = payment_token_program
    )]
    pub buyer_payment_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = platform,
        associated_token::token_program = payment_token_program
    )]
    pub payment_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = platform.payment_token_program)]
    pub payment_token_program: Interface<'info, TokenInterface>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Purchase::INIT_SPACE,
        seeds = [PURCHASE_SEED, buyer.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub purchase: Box<Account<'info, Purchase>>,
    #[account(
        init,
        payer = buyer,
        space = 8 + PackSession::INIT_SPACE,
        seeds = [SESSION_SEED, purchase.key().as_ref()],
        bump
    )]
    pub pack_session: Box<Account<'info, PackSession>>,
    pub system_program: Program<'info, System>,
}

#[vrf]
#[derive(Accounts)]
pub struct RequestPackRandomness<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [PACK_SEED, pack.platform.as_ref(), &pack.pack_id.to_le_bytes()],
        bump = pack.bump
    )]
    pub pack: Box<Account<'info, PackConfig>>,
    #[account(
        mut,
        seeds = [PURCHASE_SEED, buyer.key().as_ref(), &purchase.nonce.to_le_bytes()],
        bump = purchase.bump,
        has_one = buyer,
        has_one = pack
    )]
    pub purchase: Box<Account<'info, Purchase>>,
    #[account(
        mut,
        seeds = [SESSION_SEED, purchase.key().as_ref()],
        bump = pack_session.bump,
        has_one = purchase,
        has_one = buyer
    )]
    pub pack_session: Box<Account<'info, PackSession>>,
    /// CHECK: fixed to MagicBlock's Solana L1 VRF queue.
    #[account(mut, address = ephemeral_rollups_sdk::vrf::consts::DEFAULT_QUEUE)]
    pub oracle_queue: UncheckedAccount<'info>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct ConsumePackRandomness<'info> {
    #[account(
        mut,
        seeds = [PACK_SEED, pack.platform.as_ref(), &pack.pack_id.to_le_bytes()],
        bump = pack.bump
    )]
    pub pack: Box<Account<'info, PackConfig>>,
    #[account(
        mut,
        seeds = [PURCHASE_SEED, purchase.buyer.as_ref(), &purchase.nonce.to_le_bytes()],
        bump = purchase.bump,
        has_one = pack
    )]
    pub purchase: Box<Account<'info, Purchase>>,
    #[account(
        mut,
        seeds = [SESSION_SEED, purchase.key().as_ref()],
        bump = pack_session.bump,
        has_one = purchase
    )]
    pub pack_session: Box<Account<'info, PackSession>>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(purchase: Pubkey)]
pub struct DelegatePackSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: deserialized in the handler before the delegation CPI.
    #[account(
        mut,
        del,
        seeds = [SESSION_SEED, purchase.as_ref()],
        bump
    )]
    pub pack_session: UncheckedAccount<'info>,
}

#[derive(Accounts, Session)]
pub struct RevealCard<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [SESSION_SEED, pack_session.purchase.as_ref()],
        bump = pack_session.bump
    )]
    pub pack_session: Account<'info, PackSession>,
    #[session(signer = payer, authority = pack_session.buyer)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[commit]
#[derive(Accounts, Session)]
pub struct CommitPackSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [SESSION_SEED, pack_session.purchase.as_ref()],
        bump = pack_session.bump
    )]
    pub pack_session: Account<'info, PackSession>,
    #[session(signer = payer, authority = pack_session.buyer)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: constrained to the buyer stored in the purchase.
    #[account(address = purchase.buyer)]
    pub buyer: UncheckedAccount<'info>,
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Box<Account<'info, PlatformConfig>>,
    #[account(
        mut,
        seeds = [PACK_SEED, platform.key().as_ref(), &pack.pack_id.to_le_bytes()],
        bump = pack.bump,
        has_one = platform
    )]
    pub pack: Box<Account<'info, PackConfig>>,
    #[account(
        mut,
        seeds = [PURCHASE_SEED, purchase.buyer.as_ref(), &purchase.nonce.to_le_bytes()],
        bump = purchase.bump,
        has_one = pack
    )]
    pub purchase: Box<Account<'info, Purchase>>,
    #[account(
        mut,
        seeds = [SESSION_SEED, purchase.key().as_ref()],
        bump = pack_session.bump,
        has_one = purchase,
        has_one = buyer
    )]
    pub pack_session: Box<Account<'info, PackSession>>,
    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = stock_mint,
        associated_token::authority = pack,
        associated_token::token_program = stock_token_program
    )]
    pub prize_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = stock_mint,
        associated_token::authority = buyer,
        associated_token::token_program = stock_token_program
    )]
    pub buyer_stock_account: Box<InterfaceAccount<'info, TokenAccount>>,
    pub stock_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundExpired<'info> {
    pub payer: Signer<'info>,
    /// CHECK: constrained to the buyer stored in the purchase. No signature is
    /// required because the refund destination is also constrained to this key.
    #[account(address = purchase.buyer)]
    pub buyer: UncheckedAccount<'info>,
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Box<Account<'info, PlatformConfig>>,
    #[account(
        mut,
        seeds = [PACK_SEED, platform.key().as_ref(), &pack.pack_id.to_le_bytes()],
        bump = pack.bump,
        has_one = platform
    )]
    pub pack: Box<Account<'info, PackConfig>>,
    #[account(
        mut,
        seeds = [PURCHASE_SEED, purchase.buyer.as_ref(), &purchase.nonce.to_le_bytes()],
        bump = purchase.bump,
        has_one = buyer,
        has_one = pack
    )]
    pub purchase: Box<Account<'info, Purchase>>,
    #[account(
        seeds = [SESSION_SEED, purchase.key().as_ref()],
        bump = pack_session.bump,
        has_one = purchase,
        has_one = buyer
    )]
    pub pack_session: Box<Account<'info, PackSession>>,
    #[account(address = platform.payment_mint)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = platform,
        associated_token::token_program = payment_token_program
    )]
    pub payment_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = buyer,
        token::token_program = payment_token_program
    )]
    pub buyer_payment_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = platform.payment_token_program)]
    pub payment_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawProceeds<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump, has_one = authority)]
    pub platform: Account<'info, PlatformConfig>,
    #[account(address = platform.payment_mint)]
    pub payment_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = platform,
        associated_token::token_program = payment_token_program
    )]
    pub payment_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = authority,
        token::token_program = payment_token_program
    )]
    pub authority_payment_account: InterfaceAccount<'info, TokenAccount>,
    #[account(address = platform.payment_token_program)]
    pub payment_token_program: Interface<'info, TokenInterface>,
}

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub authority: Pubkey,
    pub payment_mint: Pubkey,
    pub payment_token_program: Pubkey,
    pub locked_payments: u64,
    pub fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PackConfig {
    pub platform: Pubkey,
    pub pack_id: u64,
    pub price: u64,
    pub reveal_timeout_seconds: i64,
    pub entry_count: u8,
    pub pending_draws: u32,
    pub enabled: bool,
    pub bump: u8,
    pub entries: [PrizeDefinition; MAX_PRIZE_ENTRIES],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Default)]
pub struct PrizeDefinition {
    pub mint: Pubkey,
    pub token_program: Pubkey,
    pub raw_amount_per_pull: u64,
    pub available_units: u32,
    pub reserved_units: u32,
    pub claimed_units: u32,
    pub enabled: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Purchase {
    pub buyer: Pubkey,
    pub pack: Pubkey,
    pub nonce: u64,
    pub amount_paid: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: PurchaseStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PackSession {
    pub purchase: Pubkey,
    pub buyer: Pubkey,
    pub selected_entries: [u8; PULLS_PER_PACK],
    pub revealed_mask: u8,
    pub claimed_mask: u8,
    pub vrf_fulfilled: bool,
    pub completed: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum PurchaseStatus {
    Paid,
    RandomnessPending,
    ResultReady,
    Settled,
    Refunded,
}

#[event]
pub struct PlatformInitialized {
    pub platform: Pubkey,
    pub authority: Pubkey,
    pub payment_mint: Pubkey,
}

#[event]
pub struct PackCreated {
    pub pack: Pubkey,
    pub pack_id: u64,
    pub price: u64,
}

#[event]
pub struct PrizeEntryAdded {
    pub pack: Pubkey,
    pub index: u8,
    pub mint: Pubkey,
    pub units: u32,
}

#[event]
pub struct PackPurchased {
    pub purchase: Pubkey,
    pub pack: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PrizeClaimed {
    pub purchase: Pubkey,
    pub slot: u8,
    pub entry_index: u8,
    pub mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PurchaseRefunded {
    pub purchase: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RandomnessRequested {
    pub purchase: Pubkey,
    pub buyer: Pubkey,
}

#[event]
pub struct RandomnessFulfilled {
    pub purchase: Pubkey,
    pub selected_entries: [u8; PULLS_PER_PACK],
}

#[event]
pub struct CardRevealed {
    pub purchase: Pubkey,
    pub slot: u8,
    pub entry_index: u8,
}

#[error_code]
pub enum MarketRipsError {
    #[msg("The configured fee is too high")]
    FeeTooHigh,
    #[msg("The authority is invalid")]
    InvalidAuthority,
    #[msg("The pack price must be greater than zero")]
    InvalidPrice,
    #[msg("The reveal timeout must be at least 60 seconds")]
    InvalidRevealTimeout,
    #[msg("The prize amount must be greater than zero")]
    InvalidPrizeAmount,
    #[msg("The inventory amount must be greater than zero")]
    InvalidInventoryAmount,
    #[msg("Disable the pack before editing its prize table")]
    DisablePackBeforeEditing,
    #[msg("The pack already has the maximum number of prize entries")]
    TooManyPrizeEntries,
    #[msg("The prize mint is already configured for this pack")]
    DuplicatePrizeMint,
    #[msg("An arithmetic operation overflowed")]
    ArithmeticOverflow,
    #[msg("At least three prize entries are required")]
    NotEnoughPrizeEntries,
    #[msg("The pack does not have enough unreserved inventory")]
    InsufficientInventory,
    #[msg("The platform is paused")]
    PlatformPaused,
    #[msg("The pack is disabled")]
    PackDisabled,
    #[msg("The prize entry index is invalid")]
    InvalidPrizeEntry,
    #[msg("The prize entry is disabled")]
    PrizeEntryDisabled,
    #[msg("The supplied prize mint does not match the selected entry")]
    InvalidPrizeMint,
    #[msg("The supplied token program does not match the selected entry")]
    InvalidTokenProgram,
    #[msg("The card slot is invalid")]
    InvalidCardSlot,
    #[msg("The VRF result is not ready")]
    ResultNotReady,
    #[msg("All cards must be revealed before claiming")]
    RevealNotComplete,
    #[msg("This prize was already claimed")]
    PrizeAlreadyClaimed,
    #[msg("The selected prize does not have a reservation")]
    ReservationMissing,
    #[msg("This purchase cannot be refunded")]
    PurchaseNotRefundable,
    #[msg("This purchase has not expired")]
    PurchaseNotExpired,
    #[msg("The payment vault cannot cover locked purchases")]
    PaymentVaultInsolvent,
    #[msg("The withdrawal exceeds unlocked proceeds")]
    WithdrawalExceedsProceeds,
    #[msg("The purchase is not in the required state")]
    InvalidPurchaseStatus,
    #[msg("Randomness was already fulfilled for this purchase")]
    RandomnessAlreadyFulfilled,
    #[msg("The purchase account does not match the reveal session")]
    InvalidPurchase,
    #[msg("The signer is not authorized for this reveal session")]
    Unauthorized,
    #[msg("This card was already revealed")]
    CardAlreadyRevealed,
    #[msg("The pending draw counter is inconsistent")]
    PendingDrawInvariant,
    #[msg("A prize could not be selected from the available inventory")]
    RandomSelectionFailed,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_cover_all_three_cards() {
        assert_eq!(ALL_CARDS_MASK, 0b111);
    }

    #[test]
    fn prize_definition_has_a_safe_default() {
        let entry = PrizeDefinition::default();
        assert_eq!(entry.available_units, 0);
        assert!(!entry.enabled);
    }

    #[test]
    fn unbiased_ticket_stays_in_range() {
        let randomness = [42u8; 32];
        for total in 1..100u64 {
            for draw in 0..PULLS_PER_PACK as u8 {
                assert!(unbiased_ticket(&randomness, draw, total).unwrap() < total);
            }
        }
    }

    #[test]
    fn vrf_selection_reserves_exactly_three_backed_units() {
        let mut pack = PackConfig {
            platform: Pubkey::new_unique(),
            pack_id: 1,
            price: 10_000_000,
            reveal_timeout_seconds: 300,
            entry_count: 3,
            pending_draws: PULLS_PER_PACK as u32,
            enabled: true,
            bump: 255,
            entries: [PrizeDefinition::default(); MAX_PRIZE_ENTRIES],
        };
        for index in 0..3 {
            pack.entries[index] = PrizeDefinition {
                mint: Pubkey::new_unique(),
                token_program: Pubkey::new_unique(),
                raw_amount_per_pull: 1_000,
                available_units: 10,
                reserved_units: 0,
                claimed_units: 0,
                enabled: true,
            };
        }
        let mut session = PackSession {
            purchase: Pubkey::new_unique(),
            buyer: Pubkey::new_unique(),
            selected_entries: [UNSET_ENTRY; PULLS_PER_PACK],
            revealed_mask: 0,
            claimed_mask: 0,
            vrf_fulfilled: false,
            completed: false,
            bump: 254,
        };

        select_and_reserve_prizes(&mut pack, &mut session, &[7u8; 32]).unwrap();

        assert_eq!(pack.pending_draws, 0);
        assert_eq!(total_available(&pack).unwrap(), 27);
        assert_eq!(
            pack.entries[..3]
                .iter()
                .map(|entry| entry.reserved_units)
                .sum::<u32>(),
            3
        );
        assert!(session
            .selected_entries
            .iter()
            .all(|index| (*index as usize) < 3));
    }
}
