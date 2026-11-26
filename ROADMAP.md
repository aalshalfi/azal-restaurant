# AZAL — Build Roadmap (owner charter, 2026-11-25)

Owner directive (2026-11-25 21:20 EST): Muse (Meta) orchestrates the team — ChatGPT + Claude — to build the complete AZAL restaurant website: ordering system, interactive menu, cart, order management. The team decides daily details autonomously; the owner receives one consolidated summary per phase checkpoint and decides only the standing gates (accounts he creates himself, payments hookup, public launch, real-world facts).

## Phases & deadlines (America/Toronto)

| Phase | Dates | Deliverable the owner can touch |
|---|---|---|
| P0 — Concept site (DONE) | — | Bilingual concept site live, brand system adopted (A2) |
| P1 — Design & experience | Thu Nov 26 – Sat Nov 28 | Design v2 live on the demo URL: structured sections (Home / Menu / Story / Visit), final dish photos (C6), typography (A2), contrast polish (C5/C11) |
| P2 — Backend foundation | Sun Nov 29 – Tue Dec 1 | Staging backend live: database schema (branches, bilingual menu, profiles, Majlis memberships, append-only points ledger), customer sign-up/sign-in working, RLS test suites green. **Owner action at phase start: create the AZAL Supabase project (~10 min, Muse guides) — accounts are always the owner's step.** |
| P3 — Ordering end-to-end | Wed Dec 2 – Sat Dec 5 | A real test order placed on staging flows cart → checkout → database → staff orders screen (cursor polling, never-miss), server-side hours enforcement, HST 13% server-side, idempotent submission |
| P4 — Majlis AZAL loyalty | Sun Dec 6 – Tue Dec 8 | Points earned on completed orders, redemption at checkout, member QR identity — one identity across future branches. **Checkpoint decision: points rates — lead proposes adopting the proven Yemen Gate rates (10 pts/$1 food value; 10,000 pts = $10) unless the owner prefers otherwise.** |
| P5 — Hardening & launch prep | Wed Dec 9 – Fri Dec 11 | Full test suites, EN/FR + mobile QA, security review, performance pass, payments wiring (Stripe — owner-approved, always last), domain hookup. **Launch itself only on the owner's word.** |

## Vision — what makes AZAL more than a menu site

1. **Majlis AZAL** — loyalty as a Yemeni majlis: members are guests of the house, not points accounts. Founding-member status for the first 100 members at opening.
2. **Sufra Compass** (v1 live) grows into guided tasting journeys: "First visit", "Aden coast", "Sana'a highlands" — each a curated path through the menu.
3. **Every dish carries its place** — region and one-line story (Sana'a, Aden, Taiz, Hadramout) in EN + FR; the menu teaches Yemeni food culture while it sells.
4. **Family platter builder** — Yemeni dining is communal; a guided builder for shareable platters by party size and budget.
5. **One identity, every branch** — account, points and preferences portable across future locations from day one (branches table already in the schema).
6. **Order status where customers live** — status updates designed for WhatsApp-first communication at launch.

## Roles under the charter
- **Muse (lead/orchestrator):** priorities, sequencing, release gate (live QA EN+FR), owner summaries at checkpoints, builds where fastest.
- **ChatGPT (no usage cap — carries volume):** implementation, F1 review, P2 schema draft, design iteration.
- **Claude (capped — rare batched asks only):** deep review / root-cause, one concentrated pass per phase at most.
