

# Integrating Local-eCash P2P Escrow into eCashPulse

## What Local-eCash Does

Local-eCash implements **script-based P2SH escrow** on eCash using `ecash-lib`. Each trade creates a unique eCash script (using `OP_CHECKDATASIGVERIFY`) that locks funds to a P2SH address. The script encodes 4 public keys (seller, buyer, arbitrator, moderator) and a nonce. Funds can only be released through specific action paths:

- Seller releases to buyer (action 01)
- Arbitrator releases to buyer (action 02)  
- Buyer returns to seller (action 03)
- Arbitrator returns to seller (action 04)
- Moderator releases/returns (actions 05/06)

Each action requires an oracle signature + the spender's signature. No single party can steal funds.

## Adaptation for Prediction Markets

The Local-eCash model is designed for **2-party P2P trades** (buyer ↔ seller). Prediction markets are fundamentally different: **many bettors → pooled funds → distributed payouts**. This creates a mismatch:

| Aspect | Local-eCash (P2P) | eCashPulse (Prediction Markets) |
|--------|-------------------|--------------------------------|
| Parties | 2 (buyer + seller) | N bettors |
| Fund flow | 1:1 escrow | Pool → distribute to winners |
| Resolution | Manual (release/return) | Oracle/automated |
| Script complexity | Fixed 2-party | Would need N-party or aggregation |

## Realistic Integration Strategy

Creating individual P2SH escrow scripts per bettor is impractical (each bet would need its own script with unique keys). Instead, we adapt the **concept** from Local-eCash:

### Phase 1: Per-Prediction Escrow with Platform Oracle (Recommended Start)

**How it works:**
1. Each prediction gets a unique keypair generated server-side
2. Funds for that prediction go to a unique P2SH address derived from a script that requires: **platform oracle signature + resolution proof**
3. The script uses `OP_CHECKDATASIGVERIFY` where the oracle message encodes the prediction outcome
4. Payouts are triggered by the oracle signing the outcome, which unlocks the funds to be distributed to winners

**What changes:**

- **New edge function: `create-prediction-escrow`** — generates a keypair per prediction, builds the escrow script using `ecash-lib`, stores the P2SH address
- **Modified `process-bet`** — directs bets to the prediction-specific P2SH address instead of the single escrow wallet
- **Modified `send-payouts`** — uses the oracle signature to unlock the P2SH script and distribute to winners
- **New DB column** on `predictions`: `escrow_script_data` (JSONB) to store the script parameters
- **Frontend `BetModal`** — displays the prediction-specific escrow address instead of the global one
- **New component: `EscrowVerifier`** — lets users verify the script on-chain (transparency)

**Dependencies:**
- `ecash-lib` must be available in Deno edge functions (via esm.sh)
- Platform holds the oracle key (stored as a secret), but funds are locked to scripts that enforce payout rules

### Phase 2: Add Arbitrator Key (Future)

Add a trusted third-party arbitrator key to the script, making it a 2-of-3 model where disputed predictions can be resolved by the arbitrator independently.

## Technical Details

### Escrow Script (Adapted from Local-eCash)

```text
Per-prediction script structure:
- Oracle PK: Platform's resolution oracle
- Payout script: Encodes winner determination logic
- Nonce: Prediction ID (unique per market)

Release path: Oracle signs outcome → funds released to winners
Refund path: Oracle signs "cancelled" → funds returned to bettors
```

### Edge Function Changes

1. **`create-prediction-escrow/index.ts`** (new)
   - Generate prediction-specific keypair
   - Build P2SH script using adapted Local-eCash `Escrow` class
   - Store script params + P2SH address in `predictions` table

2. **`process-bet/index.ts`** (modified)
   - Read prediction's escrow address from DB instead of hardcoded constant
   - Direct PayButton to prediction-specific address

3. **`send-payouts/index.ts`** (major rewrite)
   - Fetch UTXOs from prediction-specific P2SH address
   - Sign with oracle key to unlock the escrow script
   - Build multi-output payout transaction

### Database Migration

```sql
ALTER TABLE predictions 
ADD COLUMN escrow_privkey_encrypted TEXT,
ADD COLUMN escrow_script_hex TEXT;
```

The `escrow_address` column already exists on predictions.

### Frontend Changes

- `BetModal.tsx`: Use `prediction.escrowAddress` (already partially supported) instead of hardcoded `ESCROW_ADDRESS`
- New `EscrowProof` component: Shows script hex, P2SH address, and links to block explorer for verification

## Constraints

- `ecash-lib` is a Node/browser library — needs testing in Deno edge functions via esm.sh
- The platform still holds oracle keys, so this is "transparent custodial with script enforcement" rather than fully trustless
- This is a significant rewrite of the payment layer — recommend implementing alongside existing system with a feature flag

## Implementation Order

1. Database migration (add columns)
2. Create `create-prediction-escrow` edge function
3. Update `process-bet` to use per-prediction addresses
4. Rewrite `send-payouts` to use script-based unlocking
5. Update frontend to show prediction-specific addresses
6. Add escrow verification UI component

