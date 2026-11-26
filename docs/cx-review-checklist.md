# AZAL customer-experience review gate — ACCT → P3 owner test

**Owner:** ChatGPT (CX reviewer) · **Builder:** Claude · **Lead / release gate:** Muse  
**Status:** Updated 2026-11-26 to reflect Muse's approved email-OTP sign-in and the owner's adopted guest-ordering path. Execution starts on the exact branch/head Muse identifies; this is a review checklist, not evidence that any flow has passed.

## Review boundary

- Review the exact branch/commit Muse points to; do not edit Claude-owned files while his claim is active.
- Use only the approved AZAL Supabase **staging** project. No production, public-demo transactions, real payment, or real guest data.
- Sign-ups remain OFF until Muse's merge gate. Never enable them from the client or in this review.
- No service-role key, database password, or other secret in source, logs, screenshots, reply files, or commits.
- Test credentials should be synthetic where possible. The owner enters his own credentials privately when he performs his personal test.
- Keep the site's demo/preview notice until launch. "Real" in this test means a real staging database row and verified server behavior, not a public live order or a payment.

## Gate A — sign-up, sign-in and session (EN + FR, phone-first)

At 390px and desktop, verify:

1. Signed-out header state is obvious: **Sign in / Join Majlis**; links and buttons have meaningful accessible names.
2. Email is the primary identifier. The approved primary path is Supabase-native email one-time code (OTP), not password-first sign-in. Verify clear email labels, request-code feedback, resend cooldown, code-entry labels, expiry, invalid/reused-code handling and localized validation.
3. Invalid email, rate limit, offline/network failure, expired or incorrect code, duplicate/unknown account behavior and Supabase rejection produce human-readable EN and FR errors; no raw provider stack/error text. Do not reveal whether an email belongs to an account unnecessarily.
4. The confirmation state is explicit: requesting a code does not imply the account is active; successful code verification must establish the session and trigger the approved profile/membership provisioning exactly once.
5. Successful sign-in survives refresh and navigation; signed-in state is consistent on Home, Menu, Story, Reserve and Member.
6. Sign-out is discoverable, works, clears protected member data from the UI and returns to the signed-out state.
7. Loading and disabled states prevent double submits; keyboard focus, Enter/Space operation and screen-reader status announcements work.
8. Switching EN↔FR mid-flow preserves entered values where safe and does not lose the session; all labels, validation, errors and status messages are translated.

## Gate B — profile, membership and member page

1. A newly OTP-verified Auth user receives exactly one `profiles` row and one `memberships` row through the approved server-side trigger; test both a new user and an existing profile that needs backfill.
2. A missing/late profile or membership produces a recoverable loading/support state, not a blank page or crash. Refresh/retry does not create duplicates.
3. Member page shows the authenticated member's own membership state and ledger-backed points balance only; no hard-coded sample balance and no cross-user leakage.
4. Show a useful empty state for zero points and a clear loading/error state. Sign-out removes protected member data immediately.
5. Verify RLS by attempting to read another synthetic user's profile, membership and ledger: access must be denied.
6. Do not promise permanent benefits or non-expiring points unless separately approved. The current branch's founding-member wording must remain descriptive only; it must not imply an unapproved monetary benefit.
7. Points rules must come from server/schema configuration, never client arithmetic as authority. Current working earn rule: 10 points per $1 pre-tax. The adopted redemption option in Claude's ordering plan is 5,000 points = $5 and 10,000 = $10; verify it against the final migration and approved copy before release.

## Gate C — owner end-to-end test after Auth merge and ordering branch

The owner-test path now includes both **guest ordering** and the richer signed-in path. Proposal A is adopted: guests may order with name + email; email is the key for the pending points claim. Review the later ordering branch separately against `docs/p3-test-design.md`:

1. Guest can browse, add menu items and choose pickup without creating an account. Checkout clearly requests name + email and explains that email is used for the receipt and (if eligible) to claim points; do not force account creation before the order.
2. Signed-in members retain a streamlined path and may see their own estimated earn at checkout. Guest-facing earn amounts appear only at the approved post-completion confirmation/claim step.
3. Checkout includes an optional customer order-notes field; EN/FR labels, character limit, privacy, persistence on recoverable errors and correct storage are verified.
4. Client sends item IDs/options/quantities, branch, pickup time, idempotency key, guest name/email or authenticated identity, and notes only. It never supplies authoritative prices, HST, totals, earned points or claim status.
5. Server recalculates prices and HST 13%, checks configured branch hours and item availability, and rejects tampered payloads.
6. Double-submit/retry creates exactly one order. Customer A/guest A cannot read, update or cancel another customer's order.
7. Points and guest claims are created only for an eligible completed order (paid AND handed over under the current rule), never merely on placement; cancellations/refunds reverse or void exactly once. The guest claim is tied to order + email and exactly-once protected.
8. At the confirmation step, a guest sees the exact pending points and a respectful invitation to join Majlis. Claiming requires verifying the same email via OTP; the claim transfers to the member ledger exactly once and is idempotent. Unclaimed claims expire after the configurable default 90 days and expired claims are neither claimable nor displayed.
9. Order appears on the staff screen and cursor polling does not miss or duplicate it.
10. **Staging test-settlement gap to resolve:** payments are explicitly last and no real payment is authorized. Claude/Muse must define a safe staff-controlled staging-only way to drive an eligible test order through the paid/handed-over ledger path, or report the missing server function/schema requirement. Do not fake a client-side `paid` flag or award points for an unpaid order.
11. All tests use staging and synthetic data or the owner's own deliberately created test account; test rows are tagged and cleaned up/rolled back under the agreed runbook.

## Pass / fail report format

For each finding record: severity (Blocker / High / Medium / Low), exact branch + commit, page/viewport/language, reproducible steps, expected vs actual, screenshot or test reference, and recommended fix. Separate confirmed failures from unverified items.

**Release recommendation:** ChatGPT reports CX findings to Muse; Claude fixes his branch; ChatGPT re-tests the exact updated head; Muse performs live EN/FR QA and controls the merge/sign-up switch. No self-approval by the builder.
