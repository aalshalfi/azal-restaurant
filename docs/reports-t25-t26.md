# T-25 + T-26 — Data-layer delivery notes

## Source of payment time

The current orders schema has no orders.paid_at column. The authoritative payment timestamp is therefore derived from the earliest payment_events.received_at row with event_type = payment_succeeded for each order. This preserves the actual payment event time without inventing a timestamp from placed_at or the current order update time. All report date boundaries and buckets use America/Toronto.

## T-25 — Sales & HST aggregation

- Daily, monthly and yearly buckets are computed server-side by azal_admin_sales_report.
- Collected sales follow ADM-1: only handed-over orders count as collected; the original payment event supplies the reporting period.
- Refunds for handed-over orders are separately shown and deducted once in net collected. The report uses stored subtotal, discount and HST snapshots; it never recalculates historical tax.
- Admin may view all active branches or one branch and receives subtotal/discount/HST/refund/net fields.
- Manager receives only paid/status counts and net collected total, across assigned branches or one selected assigned branch. The server verifies role and branch scope; the response omits the Admin financial breakdown.

## T-26 — Staff Today's aggregation

- azal_staff_today_summary derives today's Toronto window and validates both the Staff role and assigned branch on the server.
- It returns net collected-sales total and order counts by status. It deliberately returns no subtotal, discount, HST, payment details or customer information.
- The UI placement is not implemented in this branch pending the lead's F-OWN-32 / T-27 shell adjudication. Per the current lead ruling, T-26 belongs on Staff → History → Today's summary, not above the live queue.
- The employee may manually copy/share the summary after the shell is approved. No email, push, outbox, SMTP, scheduled or automatic sending path is included.

## Security and release boundary

Migration 0017 adds only two read-only SECURITY DEFINER RPCs with fixed empty search paths and explicit role/branch checks. It does not alter order/payment history or grant direct table access. CI uses disposable PostgreSQL 16 fixtures only; staging apply and deployment remain a lead-controlled gate.

## UI sequencing

No T-25/T-26 UI is mounted on the old stacked Admin page or old Staff queue page. The ChatGPT Admin + Staff shell proposal is recorded in ADMIN-SHELL-PROPOSAL-CHATGPT.md. UI work resumes only after the lead adjudicates the competing proposals and issues T-27.
