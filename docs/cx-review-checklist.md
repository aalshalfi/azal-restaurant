# AZAL customer-experience review gate — ACCT → P3 owner test

**Owner:** ChatGPT (CX reviewer) · **Builder:** Claude · **Lead / release gate:** Muse  
**Status:** Prepared 2026-11-26; execution starts when Claude's `claude/auth-wiring` branch is ready. This is a review checklist, not evidence that the flow has passed.

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
2. Sign-up has clear email/password labels, password visibility if offered, required-field feedback, password policy and localized validation.
3. Duplicate email, invalid email, weak password, network failure and Supabase rejection produce human-readable EN and FR errors; no raw provider stack/error text.
4. Email-confirmation state is explicit if confirmation is enabled; do not imply the account is active before it is.
5. Successful sign-in survives refresh and navigation; signed-in state is consistent on Home, Menu, Story, Reserve and Member.
6. Sign-out is discoverable, works, clears protected member data from the UI and returns to the signed-out state.
7. Loading and disabled states prevent double submits; keyboard focus, Enter/Space operation and screen-reader status announcements work.
8. Switching EN↔FR mid-flow preserves entered values where safe and does not lose the session; all labels, validation, errors and status messages are translated.

## Gate B — profile and member page

1. A new Auth user receives exactly one `profiles` row through the approved trigger; test both first sign-in and an existing user with no profile yet.
2. A missing/late profile produces a recoverable loading or support state, not a blank page or crash. Refresh/retry does not create duplicates.
3. Member page shows the authenticated member's own status and ledger-backed points balance only; no hard-coded sample balance and no cross-user leakage.
4. Show a useful empty state for zero points and a clear loading/error state. Sign-out removes the balance immediately.
5. Verify RLS by attempting to read another synthetic user's profile/ledger: access must be denied.
6. Do not publish unapproved benefit promises. The current baseline `member.html` copy mentions a permanent Founding Member benefit/bonus and says points do not expire; these are proposals in `docs/majlis-proposal.md`, not yet evidenced as owner-approved rules. Flag and hold or clearly qualify this copy before activation.
7. Points rules must come from server/schema configuration, never client arithmetic as authority. Working draft: 10 points per $1 pre-tax; 10,000 points = $10. Confirm the redemption threshold/rule with Muse before any customer-facing promise or hard-coded implementation.

## Gate C — owner end-to-end test after Auth merge and ordering branch

The owner's requested path is **register → order → add order notes → see points**. Review the later ordering branch separately against `docs/p3-test-design.md`:

1. Authenticated member can add menu items and see a clear pickup selection.
2. Checkout includes an optional customer order-notes field; EN/FR labels, character limit, privacy, persistence on recoverable errors and correct storage are verified.
3. Client sends item IDs/options/quantities, branch, pickup time, idempotency key and notes only. It never supplies authoritative prices, HST or totals.
4. Server recalculates prices and HST 13%, checks configured branch hours and item availability, and rejects tampered payloads.
5. Double-submit/retry creates exactly one order. Customer A cannot read/update/cancel Customer B's order.
6. Order appears on the staff screen and cursor polling does not miss or duplicate it.
7. Points earn only on the approved completion condition (paid AND handed over in the current schema semantics); refunds/cancellations reverse exactly once.
8. **Staging test-settlement gap to resolve:** payments are explicitly last and no real payment is authorized. Claude/Muse must define a safe staff-controlled staging-only way to drive an eligible test order through the paid/handed-over ledger path, or report the missing server function/schema requirement. Do not fake a client-side "paid" flag or award points for an unpaid order.
9. All tests use staging and synthetic data or the owner's own deliberately created test account; test rows are tagged and cleaned up/rolled back under the agreed runbook.

## Pass / fail report format

For each finding record: severity (Blocker / High / Medium / Low), exact branch + commit, page/viewport/language, reproducible steps, expected vs actual, screenshot or test reference, and recommended fix. Separate confirmed failures from unverified items.

**Release recommendation:** ChatGPT reports CX findings to Muse; Claude fixes his branch; ChatGPT re-tests the exact updated head; Muse performs live EN/FR QA and controls the merge/sign-up switch. No self-approval by the builder.
