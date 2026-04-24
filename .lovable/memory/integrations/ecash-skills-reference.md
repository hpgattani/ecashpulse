---
name: eCash SKILLS.md reference
description: Canonical eCash dev libraries and patterns from ecashskill.vercel.app — use these instead of hand-rolled crypto when touching wallet/tx/address code
type: reference
---

Source: https://ecashskill.vercel.app/skills/SKILL.md (also github.com/alitayin/ecashskill)

## Recommended libraries (prefer over custom crypto.ts)

- **chronik-client** — Chronik queries + WebSocket. Already used here.
  - `chronik.address(addr).utxos()`, `.history(p, n)`
  - `chronik.tx(txid)`, `chronik.broadcastTx(rawHex)`
  - `chronik.broadcastAndFinalizeTx(rawHex)` — broadcasts AND waits for confirmation (useful for payouts/refunds)
  - WebSocket: `chronik.ws({ onMessage, autoReconnect, keepAlive })` then `subscribeToAddress(...)` — could replace 30s polling in PublicBets and bet confirmation flows.
- **ecash-lib** — transaction building & signing. Replacement for `_shared/crypto.ts` (buildSignedTransaction, bip143Sighash, hash160, P2PKH script builders).
- **ecash-wallet** — HD wallet wrapper around ecash-lib + chronik-client. Has `Wallet.fromMnemonic(...)`, `wallet.sync()`, `wallet.send(to, sats)` → `{hex}`, `wallet.broadcast(hex)`. Could simplify escrow/payout/refund edge functions dramatically.
- **ecashaddrjs** — address encoding/decoding/validation. Replacement for the custom `cashaddr.ts`.
- **paybutton** — already integrated; reference for QR + webhook patterns.
- **mock-chronik-client** — for unit tests of edge functions.

## Constants
- 1 XEC = 100 satoshis (already used everywhere)
- BIP44 coin type: ecash-wallet uses **1899** (Bitcoin ABC official). Electrum ABC uses 899. Don't mix.
- Address format: CashAddr with `ecash:` prefix.

## Chronik endpoints
Project already uses redundancy (see mem://integrations/chronik-redundancy). Canonical: `https://chronik.e.cash/`. More at https://chronik.cash.

## Where this would help us most
1. **`supabase/functions/_shared/crypto.ts`** → replace with `ecash-lib`. Removes the class of bugs that produced orphaned escrow addresses (legacy RIPEMD160).
2. **`send-payouts` / `send-refund` / `monitor-escrow`** → use `ecash-wallet` + `chronik.broadcastAndFinalizeTx` for cleaner finality semantics.
3. **`PublicBets.tsx` 30s polling** (RLS workaround) → could be augmented with Chronik WS subscription on the escrow address for instant new-bet detection.
4. **Address validation** anywhere → `ecashaddrjs` instead of custom regex/cashaddr code.

## Migration policy
Do NOT swap libraries opportunistically — payout/escrow code is security-critical. Only migrate when:
- Touching that area for another reason, OR
- User explicitly approves a refactor PR.
Always verify parity with a dry-run on testnet-style tx hex before broadcasting real funds.
