# TEAM DIRECTION — read this first, every session (owner charter, 2026-11-25)

This file is the owner's direction, restated by the team lead so there is no room for misunderstanding. If anything you remember conflicts with this file, this file wins.

## Who decides what
- **The owner (Abdulbaset)** does NOT talk to you directly anymore. He follows up ONLY through Muse. Every instruction you need arrives in this repo. Never wait for the owner, never ask him anything — if you need a decision, write it in CHATGPT-REPLY.md for Muse.
- **Muse (Meta) is the team lead / orchestrator.** Muse sets priorities and deadlines, reviews your work, and is the release gate: nothing reaches the live site without Muse's live QA (EN + FR). Muse also builds.
- **You, ChatGPT, are the implementation engine.** You are subscribed with no usage cap, so you carry the work volume. When in doubt: build it, post it, let Muse gate it.
- **Claude is SUBSCRIBED** (owner, 2026-11-25 21:58) — a full co-builder and reviewer with standing assignments from Muse (verification reviews, design critique, test design). The old spend-sparingly rule is retired.

## What we are building (not a brochure)
The COMPLETE AZAL restaurant business site for Ottawa: real ordering, interactive bilingual menu (EN + FR), cart, customer accounts, order management for staff, and Majlis AZAL loyalty (points, member identity valid across future branches). Backend = Supabase, adapted from the proven Yemen Gate blueprint. The current public page is an internal concept preview — "demo" means "not yet launched", NOT "fake front-end only". Payments hookup comes LAST and only with the owner's approval. Nobody creates accounts (Supabase, Stripe, etc.) — the owner does that himself; we prepare everything else.

## Your deadlines (ROADMAP.md has the full plan)
- **P1 — Design v2, due Sat Nov 28:** structured sections (Home / Menu / Story / Visit), C6 dish-photo swap (brief already posted), A2 typography evaluation, C5 + C11 polish. The owner already said the current design did not impress him — D1 is reopened; make v2 visibly better, not marginally different.
- **In parallel now:** your review of `docs/f1-architecture.md` (challenge it, post findings) and your P2 staging schema draft (branches, bilingual menu fields, profiles, Majlis memberships, append-only points ledger, RLS own-or-admin, idempotency keys, cursor-based staff-order reconciliation). P2 implementation starts Sun Nov 29 — the draft must be ready.
- P3 ordering end-to-end Dec 2-5 · P4 Majlis Dec 6-8 · P5 hardening Dec 9-11.

## How we work (no exceptions)
1. Session start: read COORDINATION.md, this file, ROADMAP.md, BOARD.md, and the latest sections of MUSE-REPLY.md and CLAUDE-REPLY.md.
2. Claim your task on BOARD.md before starting; work on a branch; the builder never self-certifies — Muse merges after live QA.
3. Definition of done: works in EN + FR, desktop + mobile, demo notices intact where they still apply, smoke tests green.
4. Think like a partner, not a contractor: propose better ideas in IDEAS.md, flag decisions that limit the brand — but ideas never block the deadline work.
5. Reply in CHATGPT-REPLY.md using the COORDINATION.md template.

## Your next reply must include
A short restatement, in your own words, of: (a) who leads and who you report to, (b) what we are building, (c) your two current assignments and their deadlines. Muse will verify your understanding from that restatement.


## Amendment 2026-11-25 22:31 EST — Owner design verdict (binding)

The owner rejected the one-page v2 layout ("crowded, everything on one page"). P1 v3 direction: THREE separate pages — Home (short, calm), Menu (all ordering), Story — generous whitespace, one idea per section. Details in MUSE-REPLY.md, 22:31 section. This amendment overrides any earlier one-page design direction.


## Amendment 2026-11-25 22:50 EST — Foundation-first rule (owner-directed)

Adjustable details never block a build. The lead sets a sensible provisional default (as a config value, never hard-coded) and work proceeds; the owner adjusts later. Current defaults: open 7 days, 11:00–21:00; max party 10; capacity 50. Only irreversible actions and real-world facts wait for the owner.


## Amendment 2026-11-25 22:52 EST — Claude: technical & design lead, full portfolio

Per the owner ("let him loose — lots of tasks"): Claude is technical & design lead; his design/schema verdicts are binding unless Muse escalates. His standing portfolio (critical path C-REV + C-DES v3, then C-TST, dish stories, R1 spec, Majlis proposal, reservations schema, a11y/FR audit, launch gates) is listed in MUSE-REPLY.md 22:52. He works it continuously without waiting for assignments.


## Amendment 2026-11-25 22:56 EST — Continuous work (owner-directed)

"Keep them working continuously, without stopping." Both portfolios (Claude: MUSE-REPLY 22:52; ChatGPT: MUSE-REPLY 22:55) never run dry: finish an item → post its result → start the next queue item in the same session. The lead's loop checks every 15 minutes, verifies finished items, and names the next unblocked task whenever a queue thins. Nobody waits for permission between queue items.


## Amendment 2026-11-25 23:07 EST — 5-minute team cadence

The owner set every collaborator to a 5-minute check-in rhythm (Claude self-scheduled in his app; Muse's loop now runs every 5 minutes; ChatGPT instructed to do the same). Discipline: no overlapping rounds, no empty posts when nothing changed — silence between rounds is normal; finished work is what gets posted.


## Amendment 2026-11-26 05:12 EST — Capacity allocation (owner)

The owner ruled: Claude is the most responsive collaborator and Muse's own capacity is limited — so the bulk of BUILD work goes to Claude (he is now primary builder as well as technical & design lead). ChatGPT takes bounded, explicitly-tagged tasks with exact files and acceptance criteria, plus customer-experience reviews. Muse restricts itself to lead duties: priorities, gates, live QA, the Supabase apply, and owner reporting.


## Amendment 2026-11-26 05:16 EST — Claude's self-development mandate (owner)

The owner directed that Claude develop himself: research, edit, propose ideas, and keep building autonomously until Muse's capacity recovers. Claude self-feeds his queue (noting picks in his reply file), builds Tier-A work on claimed branches, and brings research-backed proposals. Gates unchanged: two-eyes merge rule, Muse live-QA gate, Tier-C to the owner.


## Amendment 2026-11-26 05:28 EST — Guest ordering adopted (owner + lead ruling)

Proposal A is adopted: guests may order with name + email; points from a guest order are recorded as a pending claim tied to the order's email (recorded at completion, exactly-once), shown at confirmation with a join offer, and claimed into the member ledger automatically when the guest verifies that email and joins. Unclaimed claims expire (default 90 days, config). This supersedes the earlier signed-in-only ordering rule; signed-in remains the richer path.


## Amendment 2026-11-26 05:26 EST — Orders are paid online (owner rule, reported by Claude)

No order without payment. A table reservation can be without payment, but an order is paid. A TEST payment system (fake credit cards, test mode only, no real money, no card data) is built so readiness can be proven before launch. Counter payment is removed; the kitchen refuses unpaid orders. Going live with real payments is a separate Tier-C owner decision on his own provider account.
