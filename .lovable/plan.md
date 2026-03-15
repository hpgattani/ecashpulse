

# Transitioning to Non-Custodial Escrow

## Current Architecture

Your platform is fully **custodial**: all bets are sent to a single escrow address (`ecash:qz6jsg...`), and the server holds the private key (`ESCROW_PRIVATE_KEY_WIF`) to sign payout transactions. This means you have full control over user funds at all times.

## The Challenge

eCash (XEC) is a UTXO-based chain with limited smart contract capabilities compared to Ethereum/Solana. There is no EVM, no programmable escrow contracts. This makes true "trustless" escrow significantly harder than on EVM chains.

## Realistic Options

### Option A: Multi-Signature Escrow (Partially Non-Custodial)
- Use 2-of-3 multisig: **platform key + user key + neutral arbiter key**
- Funds require 2 signatures to move, so the platform alone cannot steal funds
- **Pros**: Meaningful trust reduction, achievable on eCash
- **Cons**: Complex UX (users must sign payouts), requires an arbiter service, significant rework of the entire bet/payout flow

### Option B: Per-Prediction Escrow Addresses (Transparency, Still Custodial)
- Generate a unique escrow address per prediction market
- All keys are still server-held, but funds are isolated and auditable per market
- **Pros**: Easier to implement, better transparency and auditability
- **Cons**: Still technically custodial (you hold the keys)

### Option C: eCash Script Covenants (Advanced, Experimental)
- Use eCash's OP_CHECKDATASIG to create script-based escrow that auto-releases funds based on signed oracle data
- Oracle signs the outcome, and the script allows winners to claim directly
- **Pros**: Truly non-custodial, trustless resolution
- **Cons**: Extremely complex to build, eCash covenant tooling is immature, would essentially be a ground-up rewrite of the payment layer

### Option D: Hybrid — Transparent Custodial with Proof-of-Reserves
- Keep the current architecture but add:
  - Public escrow address balance verification on every page
  - Real-time proof-of-reserves showing total deposits vs total liabilities
  - Automated payout triggers (no manual intervention needed)
  - Time-locked auto-refunds if predictions aren't resolved within X days
- **Pros**: Minimal code changes, builds trust without full non-custodial complexity
- **Cons**: Still custodial in the technical sense

## Recommendation

**Option D (Hybrid Transparency)** is the most practical near-term improvement. True non-custodial on eCash (Options A or C) would require a fundamental rewrite of the payment infrastructure and months of development. Option D can be implemented in days and meaningfully increases user trust.

If you want to go further, **Option A (Multi-sig)** is the next realistic step, though it requires significant UX changes and a third-party arbiter.

## What Would Need to Change (for each option)

| Component | Option A (Multisig) | Option B (Per-prediction) | Option C (Covenants) | Option D (Transparency) |
|-----------|-------------------|-------------------------|---------------------|----------------------|
| `send-payouts` | Full rewrite | Moderate changes | Full rewrite | Minor additions |
| `process-bet` | New signing flow | New address generation | Full rewrite | Add balance checks |
| `paybutton-webhook` | Multi-sig validation | Route to correct address | New claim flow | No change |
| Frontend (BetModal) | User signing UX | Minor | Claim button UX | Add proof-of-reserves widget |
| New infrastructure | Arbiter service | Key management | Oracle signing service | Balance verification API |

