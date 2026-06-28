## Security announcement: site banner + tweet thread

### 1. Dismissible top banner
- Create `src/components/SecurityAnnouncementBanner.tsx`:
  - Thin bar above the header, full width, liquid-glass style (matches site design tokens — teal/purple gradient border, subtle blur).
  - Copy: "🔒 Escrow keys now encrypted at rest with AES-256-GCM. P2SH multisig escrow coming next."
  - Optional small "Learn more" link → opens a lightweight inline `<details>` or scrolls to nothing for now (link omitted if not needed).
  - Close (X) button on the right.
  - Dismissal stored in `localStorage` under key `security-banner-aes-gcm-dismissed` (versioned so future banners can re-show).
  - Mobile-first: text truncates / wraps cleanly at 360px; close button stays tappable (44px target).
- Mount once in `src/App.tsx` above `<Header />` so it appears on all routes.
- No business-logic changes, no backend changes.

### 2. Tweet thread (text only, for user to copy-paste)
Delivered in the chat reply — not stored in the app. Three tweets:

1. **What shipped** — short, factual: per-prediction escrow private keys are now encrypted at rest. Stealing a DB dump is no longer enough to move funds.
2. **Technical detail** — AES-256-GCM, random IV per record, key-encryption-key held outside the database in platform secrets, injected only into server-side functions at runtime. Backward-compatible migration on first use.
3. **What's next** — P2SH multisig escrow on the roadmap, removing single-key custody entirely. Built on eCash.

No bounty, no "crack it" challenge, no "best in class" wording.

### Files touched
- New: `src/components/SecurityAnnouncementBanner.tsx`
- Edit: `src/App.tsx` (mount banner)

### Out of scope
- No edge function changes, no DB changes, no schema changes.
- No dedicated `/security` page (can add later if you want).