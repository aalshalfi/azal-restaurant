# Apply 0009 — restaurant NEW_ORDER alert outbox

**Owner/operator:** Muse (team lead) only. This document does not authorize a database apply.
**Migration:** `supabase/migrations/0009_order_notifications.sql`.
**Purpose:** create one durable restaurant alert event when an order transitions to `paid`, with a snapshot of the persisted order and item lines.

## Safety state

- Sender is hard-disabled by the database constraint (`sender_enabled = false`).
- Every generated event is recorded as `blocked` with `sender_disabled` (or `recipient_not_configured`).
- No SMTP credentials, DNS records, sender service, Edge Function, or real email delivery is configured.
- The event is an alert record only; the authenticated staff queue remains the source of truth.
- This migration is forward-only. Do not edit or re-run older migrations.

## Preflight (read-only)

Confirm the intended staging database and that the ordering schema exists:

```sql
select current_database(),
       to_regclass('public.orders') is not null as has_orders,
       to_regclass('public.order_items') is not null as has_order_items,
       to_regclass('public.branches') is not null as has_branches,
       to_regclass('public.app_settings') is not null as has_app_settings;
```

All four values must be true. Confirm the current project ref separately before applying. Do not apply to production.

## Post-apply checks (lead-run only)

```sql
select to_regclass('public.order_outbox') as outbox,
       to_regclass('public.order_notification_settings') as settings,
       (select sender_enabled from public.order_notification_settings where branch_slug = 'ottawa') as sender_enabled,
       has_table_privilege('anon', 'public.order_outbox', 'select') as anon_can_read,
       has_table_privilege('authenticated', 'public.order_outbox', 'select') as member_can_read;
```

Expected: both tables exist, sender_enabled is false, and both client roles cannot read the outbox.

For a test order that becomes paid, verify exactly one row exists for its `(order_id, 'NEW_ORDER')`, status is `blocked`, `last_error = 'sender_disabled'`, and the payload contains persisted line items, pickup time and totals. Replaying the same payment transition must not create another row.

## Email template

`order-email.js` renders branded English/French HTML plus a plain-text fallback. Dynamic content is HTML-escaped. The sender adapter requires an injected provider and remains disabled by default. A provider acknowledgement is labelled `sent`, never `delivered`; delivery status requires separate provider evidence.

## Not done / not authorized here

- No database migration has been applied.
- No real or staging SMTP sender has been configured or invoked.
- No sender worker, retry loop, webhook, DNS, or credentials are activated.
- No merge or deployment is performed by ChatGPT; Muse owns those gates.
