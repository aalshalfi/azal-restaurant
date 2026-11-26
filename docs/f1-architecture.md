# AZAL — Full-build architecture (F1 / P1)

Status: **draft for review** — posted by Muse (lead) 2026-11-25 20:12 EST.
Reviewer: Claude (batched ask — review before any implementation).
Source blueprint: the owner's proven Yemen Gate Supabase schema **v5.4**
(`~/workspace/yemen-gate-site/schema_v5.4.sql`, 1,209 lines, live on staging,
suites 14/14 + 29/29). This note adapts it; it does not redesign it.

## 0. Ground rules (from the owner, 2026-11-25 20:04)

- Build the **complete** site: front end + real backend + real customer
  accounts + Majlis AZAL membership/points. "Demo" means unlaunched and
  internal only — never partial or faked.
- Public launch only on the owner's word. Payments hookup last and
  owner-approved. The owner creates/secures the Supabase account himself.
- No invented business facts. Sample menu stays labelled sample until the
  owner supplies the real menu. Points **rates and tiers are Tier C** —
  owner decisions, still pending (see §6).
- Staging stays staging. Nothing reaches `main` / the published site without
  two-eyes review + live QA (EN + FR, desktop + mobile).

## 1. Stack (unchanged from the proven blueprint)

- **Front end:** the existing static site (GitHub Pages). No framework swap.
- **Backend:** Supabase — Postgres + Auth + Row Level Security. All money
  and points logic lives in database functions, never in the browser.
- **Separation:** staging project first (P2). Production is a separate
  project, untouched until the owner approves launch.

## 2. What carries over unchanged from Yemen Gate v5.4

| Piece | Why it stays |
|---|---|
| `profiles` (no FK to `auth.users`, so deleting a login never cascades into financial records) | Proven; protects the ledger |
| `user_roles` (`customer` / `staff` / `admin`), roles set only by the database owner | Staff can never promote themselves |
| `menu_items` + `menu_item_options` as the trusted server-side price list | The browser never sets prices |
| `orders` lifecycle: `placed → accepted → ready → completed / cancelled / refunded`; `completed` = paid AND handed over | Completion evidence, not a flag |
| `points_ledger` append-only, balance = `sum(delta)`, exactly-once unique indexes (one `earn`, one `earn_reversal`, one `redeem_refund` per order) | No double-credit, ever |
| `payment_events` + `settlement_batches` + `payment_settlements` audit spine | One row per collection and per reversal |
| `place_order` / `mark_order_paid` / `confirm_handover` / `complete_order` / `refund_order` / `void_paid_order` / `record_card_settlement` / `anonymize_customer` / `my_balance` as security-definer functions, EXECUTE revoked from `public`/`anon` | Clients can only call the guarded paths |
| RLS: ledger/orders/profiles readable own-or-admin; no client INSERT on orders, ledger or payment events; no DELETE anywhere | Same own-or-admin pattern, verified |
| `(user_id, idempotency_key)` unique index on orders | A retried submission can never duplicate an order |
| Server-side hours enforcement + cursor-based staff-order reconciliation + polling staff alerts | Mandatory pre-launch gates, carried from the Yemen Gate repair plan (Batches B–D lessons) |

## 3. Schema deltas for AZAL (the actual P1 work)

### D1 — `branches` table (branch dimension from day one)
```sql
create table public.branches (
  slug text primary key,            -- 'ottawa' first
  name_en text not null,
  name_fr text not null,
  city text not null,               -- 'Ottawa' (city level only; no address — Tier C)
  timezone text not null default 'America/Toronto',
  tax_rate numeric(5,4) not null,   -- 0.1300 (Ontario HST 13%)
  active boolean not null default true
);
```
`orders.branch` becomes `text references public.branches(slug)` instead of
Yemen Gate's locked `check (branch = 'orleans')`. One customer identity and
one points balance across all branches, from day one (Majlis is brand-wide,
not per-branch).

### D2 — Tax: Ontario HST 13%, computed server-side
`place_order` reads the branch's `tax_rate` and snapshots `tax` on the order
row. The browser never computes tax. If a branch rate ever changes, old
orders keep their snapshot. AZAL's first branch is Ottawa, Ontario → HST 13%.

### D3 — Bilingual content fields
`menu_items` gains `name_fr` / `description_fr` (and `category_fr`, or a
`categories` table with `name_en` / `name_fr`). The front end already ships
EN+FR UI strings; the backend must store both languages so a French order
confirmation and a French receipt read exactly what the guest saw. Rule: no
menu row ships with a missing French field — the CI smoke test pattern from
CI2 (every dish has a French translation) extends to the seed.

### D4 — Majlis membership
```sql
create table public.memberships (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  tier text not null default 'member',   -- tiers are Tier C; default is a placeholder
  joined_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','suspended'))
);
```
Points ledger shape is unchanged (`delta`, `reason`, `order_id`,
`balance_after`). Earn rule stays server-side: credit **only** when an order
becomes `completed` (paid + handed over); cancelled/incomplete orders earn
nothing; no manual points entry; no in-store accrual unless the owner says so.

### D5 — Branch hours (server-side enforcement, mandatory)
```sql
create table public.branch_hours (
  branch text not null references public.branches(slug),
  weekday int not null check (weekday between 0 and 6),
  opens time, closes time,              -- null = closed that day
  primary key (branch, weekday)
);
```
`place_order` rejects orders outside hours and outside the pre-order window
(the Yemen Gate plan allows scheduled pre-orders while closed — same rule
here, decided once hours exist). Hours themselves are Tier C facts.

### D6 — What does NOT change for AZAL
No delivery integration, no third-party ordering, no payment provider in P2–P4.
Payment methods stay `cash` / `card_terminal` until the owner approves the
payments hookup (P5, last).

## 4. Auth & accounts (P2–P3)

- Supabase Auth, email sign-in. Public signups stay **disabled** on the
  public demo until the staging wiring is verified closed, exactly as Yemen
  Gate staging was verified (probe: signup rejected).
- The owner creates/secures the Supabase project and any service credentials
  himself (standing rule). We build inside it; we never hold its owner keys.
- Staff/admin promotion is done by the database owner in the dashboard only.

## 5. Sequencing after this note

1. **Claude reviews this note** (batched ask, 20:08 section): three
   highest-leverage decisions to lock now + two most likely failure modes.
2. **P2 — staging backend:** project (owner) → deploy adapted schema →
   replicate the Yemen Gate test-suite pattern (function/RLS suites) →
   verify signups closed.
3. **P3 — accounts/membership UI on staging:** sign-up/sign-in, Majlis
   points balance + history, order history — staging link only.
4. **P4 — ordering end-to-end on staging:** menu → cart → checkout →
   staff view, with cursor-based reconciliation and server-side hours.
5. **P5 — QA gates, then owner review:** full EN+FR × desktop/mobile
   regression, ledger correctness, RLS probes. Payments last, owner-approved.

Front-end track (D1 design elevation, C10, C6, C9-mobile) runs in parallel on
separate branches; `main` stays green; CI2 guards the language switch.

## 6. Owner decisions still pending (Tier C — do not guess)

- Majlis points earn rate, redemption value, and tier names/rules.
  (Yemen Gate's proven defaults — 10 pts per $1, 10,000 pts = $10, no signup
  bonus — are the reference proposal only, not AZAL's rules.)
- Supabase project creation (his account).
- Real menu, prices, photos, address, phone, hours, social accounts.
- Payments provider + hookup timing.

## 7. Open risks (for Claude's review)

1. **Bilingual drift:** front-end UI strings and DB content are two sources
   of truth for French; a dish renamed in one and not the other ships a
   mismatch. Mitigation: seed from one bilingual source, CI check on both.
2. **Points rules undecided:** the ledger earn path cannot be finalised
   until §6 is decided — build the ledger shape now, wire the earn rate as a
   single configurable value, not hard-coded.
3. **Branch tax snapshot vs. rate change:** D2 snapshots tax per order; a
   future second province needs per-branch rates tested, not assumed.
4. **Staff reconciliation at volume:** cursor-based listing must be proven
   with a load test before launch, not trusted from the Yemen Gate pattern.
