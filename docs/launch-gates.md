# Launch gates checklist (task 9) — Claude, 2026-11-25

The site goes from "preview" to "real" only when every gate below is green or explicitly waived by the owner in writing. A gate marked **Owner** needs a real-world fact, an account or a legal decision that no agent may invent (Tier C). Status values: open / ready for QA / passed.

## A. Brand and content (Owner supplies; agents never invent)
- [ ] Real address, phone, public email, hours confirmed (hours 11:00–21:00 given by owner 22:39; days provisional).
- [ ] Final menu and prices; removal of "illustrative/sample" labels only when real. Dish photos are real AZAL photos or owner-licensed (current ones are illustrative).
- [ ] Allergen and dietary information per dish (sesame/tahini, dairy in chai, nuts, gluten in bread). Legal exposure if wrong.
- [ ] Dish stories reviewed by the kitchen (`docs/dish-stories.md`).
- [ ] No reviews, awards, social accounts or claims until real and owner-provided.
- [ ] Logo and palette unchanged (#42220E, #CD8E2D, #914820, #F8F1E7).

## B. Legal and policy (Owner; I am not a lawyer — a professional should confirm)
- [ ] Privacy policy and terms page, EN/FR, listing exactly what is collected (name, email, optional phone, order history, points) and retention (reservations 12 months proposed).
- [ ] Consent wording at sign-up and booking; unsubscribe for any marketing email (CASL applies to commercial emails in Canada).
- [ ] HST registration number and rate on receipts (13% server-side; registration is the owner's real fact).
- [ ] Loyalty-program terms: earn/burn rates, expiry (if any), what happens on account deletion (Majlis proposal).
- [ ] French-language requirement for Quebec customers is not assumed; owner decides the markets.

## C. Security and data (Claude reviews, Muse runs live checks)
- [ ] `0001` applied once to the staging project; live Q1–Q12 (`docs/supabase-verify.sql`) all match EXPECT; Q5 zero rows and Q5b exactly one row.
- [ ] RLS on every public table; no client INSERT/UPDATE/DELETE grants; every function: `search_path` pinned, revoked from `public` and `anon` unless intentionally public (a standing check for every new function).
- [ ] Public sign-up policy decided; email confirmation enabled; redirect URLs set to the real domain only.
- [ ] No service-role or secret key in the repo, history, client bundle or logs (grep + secret scan in CI).
- [ ] Staff accounts: least privilege, branch-scoped, MFA for admin (owner-held accounts).
- [ ] Backups/point-in-time recovery enabled on the production project; restore tested once.
- [ ] Separate staging and production projects; production never used for tests.
- [ ] Rate limits for sign-up, booking and order placement; abuse path documented.
- [ ] Security headers on the host (CSP, referrer policy); third-party scripts minimized; fonts self-hosted.

## D. Money (last, owner approval each)
- [ ] Payment provider account, held and approved by the owner; test mode proven first; no card data ever stored by us.
- [ ] Refund and cancellation flow tested; reconciliation between orders, payments and ledger.
- [ ] Order notification reaches staff reliably (polling or realtime) and has a fallback (S1–S5).

## E. Quality
- [ ] CI green (`node --test tests/*.test.mjs`, static schema checks); P0 cases of `docs/p3-test-design.md` all pass.
- [ ] Accessibility: contrast ≥4.5:1 for text, visible focus, keyboard-operable menu/cart/forms, tap targets ≥44px, `lang` attribute correct per language, form labels, error text announced.
- [ ] French completeness: every EN key has an approved FR string; no mixed-language screens.
- [ ] Performance: images lazy-loaded and sized, fonts subset/self-hosted, Home first view small; Lighthouse mobile run by Muse on the live site (agents cannot).
- [ ] Real-device pass: iPhone Safari and Android Chrome by Muse/owner (agents have no real devices).
- [ ] Domain, HTTPS, 404 page, favicon, share image; sitemap/robots decided by owner.

## F. Operations
- [ ] Who receives booking and order emails; a named person checks them during opening hours.
- [ ] Out-of-hours behavior defined (pre-order or closed message).
- [ ] Rollback path: previous deployment can be restored in minutes; schema changes forward-only with a documented undo for each.
- [ ] Staff short guide (one page, EN/FR) for orders and bookings.
- [ ] Owner sign-off recorded in `MUSE-HANDOFF.md` by Muse (I cannot edit that file) before the first real order or booking is accepted.

## How to use
Each launch candidate gets a copy of this list in `BOARD.md` with owner names. Agents tick only what they verified themselves and say how; Owner and Muse tick live and real-world items.
