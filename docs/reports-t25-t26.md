# T-25 + T-26 — reporting data contract

## Payment-time provenance

**orders.paid_at** is a server-managed, immutable timestamptz.
- Migration 0017 backfills the earliest payment_events.received_at for payment_succeeded.
- Legacy rows without that provider event may use the earliest durable order_events.created_at for event_type='paid'.
- Migration preflight aborts before schema changes if any paid/refunded order has neither source.
- New paid transitions require an existing payment_succeeded event. The trigger never invents a timestamp with now() or clock_timestamp().
- Refunds preserve the original paid_at; they do not move the sale into the refund date's bucket.

All report periods are calendar dates in America/Toronto, with an inclusive p_end_date translated to an exclusive next-midnight instant. The SQL suite pins the 2026 spring/fall DST day lengths, the March 8 2026 DST-day fixtures, December 31 2026, and January 1 2027.

## T-25 — Admin / Manager sales report

The azal_sales_report SECURITY DEFINER RPC uses a fixed empty search_path, validates the role and date range, and derives Manager access from server-side assigned branches. A Manager may see all of their assigned branches or filter to one assigned branch; a client-supplied slug never expands scope.

Collected convention remains ADM-1: only handed_over orders count as collected. A refunded order handed over before refund remains part of gross collected and its successful refund events are shown separately; net is gross less those refunds. A refund before handover is not counted as collected or as a collected refund.

- **Admin:** gross collected_cents, separate refunds_cents, explicit net_collected_cents, order/status counts, and stored subtotal/discount/HST snapshots. Historical tax is never recalculated.
- **Manager:** assigned-branch order/status counts and net_collected_cents only. No gross collection, refund amount, subtotal, discount, HST, payment detail, or customer PII.
- All money remains integer cents in SQL.

## T-26 — Staff Today's summary

The azal_staff_today_summary RPC is Staff-only and server-checks the authenticated Staff identity's assigned branch. It uses the current Toronto calendar day and returns status counts plus net_collected_cents only. It does not return gross collections, refund breakdown, subtotal, discount, HST, payment details or customer data.

The employee may manually copy/share the on-screen summary after the shell is built. No email, push, outbox, SMTP, scheduled or automatic sending path is included.

## Verification and release boundary

CI creates a disposable PostgreSQL 16 database, seeds pre-0017 paid fixtures, tests both payment-event and legacy order-event backfill, and separately proves a paid row with no provenance causes 0017 to fail atomically without leaving orders.paid_at. The post-migration suite tests the missing-event paid-transition guard, immutability, refunds before/after handover, Admin/Manager/Staff payload separation, and deterministic Toronto day/month/year boundaries.

Migration 0017 remains source-only until Muse/lead review, isolated staging identification, backup/restore evidence, one controlled apply, and the live Admin/Manager/Staff aggregate walk. No production apply or live reporting activation is authorized by this document.
