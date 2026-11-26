# Majlis AZAL program proposal (task 6) — Claude, 2026-11-25. Decision-ready for the P4 checkpoint. All numbers below are arithmetic on the v5.4 rates stated by Muse; no AZAL sales, margin or traffic figures exist, so none are assumed.

## 1. What the program is
A membership in the spirit of the majlis, the Yemeni gathering room where everyone is a guest: sign up once, earn points on pickup orders, spend points on the next meal. It stays inside the guest's existing flow (no extra step to earn: points appear after the order is paid and handed over).

## 2. v5.4 baseline math
Earn **10 pts per $1** (on the pre-tax subtotal, floored). Burn **10,000 pts = $10**. So value per point = $0.001 and the **effective reward rate = 1.0 % of spend**, the cost to AZAL (at face value, before breakage) is 1 cent per dollar. Examples: a $25 order earns 250 pts; a $12.99 order earns 129 pts; a guest reaches a $10 reward after **$1,000 of spend**. At $30 a visit that is about 33 visits; weekly guests need about 8 months. Honest reading: it is safe for margin but slow to feel rewarding.

## 3. Options (owner decides; I recommend B)
| Option | Earn | Burn | Effective rate | First reward after (spend) | Note |
|---|---|---|---|---|---|
| A Keep v5.4 | 10 pts/$1 | 10,000 = $10 | 1.0 % | $1,000 | Lowest cost; weak motivation. |
| **B Faster first reward** | 10 pts/$1 | 5,000 = $5 for first reward, then 10,000 = $10 | 0.5 % per point at the entry level, 1.0 % after | $500 | One small early win; same long-run cost; ledger-friendly (a reward catalogue with two steps). |
| C Double earn | 20 pts/$1 | 10,000 = $10 | 2.0 % | $500 | Simple and generous; doubles cost. |
Founding bonus and tier multipliers are additive to any option and bounded in section 5.

## 4. Tiers (by points earned in the last 12 months; names need owner approval, Arabic is Tier C)
| Level | EN | FR | AR (draft, owner to approve) | Threshold (12-month earn) | Benefit |
|---|---|---|---|---|---|
| 1 | Guest | Invité | ضيف | 0 | Base earn. |
| 2 | Companion | Compagnon de table | جليس | 3,000 pts (≈$300) | +10 % earn, a birthday dish (owner-chosen). |
| 3 | Honoured | Hôte d’honneur | مُكرَّم | 10,000 pts (≈$1,000) | +20 % earn, priority table request (ties to reservations). |
Benefits are examples. Every benefit with real cost (free dish, priority) needs the owner's approval; the points ledger alone can run levels 1–3 without any benefit if the owner prefers to start with earn bonuses only.

## 5. Founding members (first 100)
Mechanics: the first 100 accounts that complete a first paid order get a permanent "Founding member" badge and a **+25 % earn bonus** for life (never a free item). Cost bound at option A: extra 0.25 % of the founders' own spend only; with 100 founders spending $S each the added liability is **100 × S × 0.0025** (e.g., S = $500 → $125 in total, at face value). Scarcity is real (a numbered "Founding No. 37 of 100" line) and counted by the server, not the client. The count and badge are stored on the profile at the moment of first paid order, once (unique index), so two simultaneous orders cannot both be 100th (same exactly-once pattern as `earn`).

## 6. Rules to decide (defaults are my recommendation)
- Earn only on **paid and handed-over** orders (D9/A6). Cancelled or refunded orders reverse the earn once (`earn_reversal`, already in `0001`).
- Points on subtotal **before tax**, **not on tips** (no tips exist yet), **not on redeemed amounts** (spending points does not earn points).
- **Expiry:** recommend none at launch (simplest, friendliest); if the owner wants expiry, it is a legal/accounting gate (see launch-gates B), and must be announced at sign-up.
- Redemption at checkout, applied before tax? Decision: points reduce the subtotal, and HST is charged on the reduced amount (to be confirmed by the owner's accountant: Tier C).
- No cash value, no transfer between accounts, one account per person (email-verified).
- Abuse: one earn per order (unique index), refunds reverse, staff-granted adjustments are logged with the actor.
- Data minimum: name, email, optional phone; show the member a "delete my account" path (legal gate).

## 7. What the guest sees (calm, no clutter)
Header: "Join Majlis" / "Rejoindre le Majlis" (one link, already in v3 plan). Member page: one number (points), one line ("X more points to your next reward"), level badge, last five movements. After an order: one line of text, "You earned 129 points." No pop-ups, no spinning wheels, no countdowns.

## 8. Decisions for the owner at the checkpoint
1. Option A, B or C. 2. Tier names (EN/FR/AR) and which benefits are real. 3. Founding-100 yes/no and the bonus (25 % default). 4. Expiry yes/no. 5. Whether points reduce the taxable amount (accountant). Until then, the site shows the program as "coming soon" without numbers promised to guests.
