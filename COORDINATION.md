# AZAL — Coordination protocol (ChatGPT ⇄ Muse)

Single source of truth for how ChatGPT and Muse work together. Boundaries and owner authorization live in `MUSE-HANDOFF.md` and still apply in full. This file only organizes the workflow. Times are always Toronto time.

## 1. Who owns what

| File | Written by | Rule |
|---|---|---|
| `CHATGPT-REPLY.md` | ChatGPT only | Append new dated sections at the end. Never rewrite old ones. |
| `MUSE-REPLY.md` | Muse only | Append new dated sections at the end. Never rewrite old ones. |
| `BOARD.md` | Both | The task board and file claims. Update your own rows only. |
| `IDEAS.md` | ChatGPT | Ledger of ideas. Muse critiques in `MUSE-REPLY.md`, not in this file. |
| `MUSE-HANDOFF.md` | Owner / ChatGPT | Boundaries and authorization. Do not edit without the owner. |
| `index.html`, `script.js`, `styles.css` | Whoever holds the claim | See section 2. |

## 2. File claims (avoid simultaneous edits)

1. Before editing a code file, add a row in the **Claims** table in `BOARD.md` (file, owner, task id, start time) and commit it.
2. Pull the latest `main` immediately before you edit.
3. Edit, test, commit, push.
4. Release the claim in the same push (delete your row, or mark it Released with the commit SHA).
5. A claim older than 3 hours with no commits is stale. The other side may take the file and must note it in their reply.

## 3. Cycle (one run)

1. Read `BOARD.md`, then the other side's latest reply section, then `git log -10`.
2. Verify the other side's claims against the actual files and commits, not against their summary.
3. Pick the highest-value safe task from the board. Do not wait for the other side.
4. Implement, then verify (see section 5).
5. Append a reply using the template below.
6. Update `BOARD.md`.

Daily check-in window agreed with the owner: **9:00 PM Toronto**. If you are running earlier, do the next safe block now.

## 4. Reply template (append to your own reply file)

```
## YYYY-MM-DD HH:MM EST (Toronto) — <short title>

**Summary:** one or two sentences.
**Tasks:** <ids from BOARD.md> — Done / In progress / Blocked
**Files changed:** list
**Commits:** full SHAs
**Verification:** what was run, on which URL, and the result
**Findings / bugs:** reproducible steps for each
**Questions for the other side:** numbered
**Owner decisions needed:** only real-world facts or boundary items, or "none"
```

## 5. Definition of done

A task is Done only when all of these hold:
- The change is committed on `main` and the SHA is recorded.
- The published URL was loaded after the deploy and the affected feature was exercised (not just a syntax check).
- For UI work: checked in English and French, and at desktop and mobile widths.
- No sample dish, price, cart or checkout is presented as real. The demo notices are intact.
- The other side has been told what to re-test.

## 6. Hard boundaries (summary, full text in `MUSE-HANDOFF.md`)

No invented address, phone, hours, final menu or prices, social accounts, reviews or awards. No real orders, payments, reservations, delivery integrations or personal-data collection. No spending, no account or billing changes. Keep the AZAL logo and palette (#42220E, #CD8E2D, #914820, #F8F1E7). No destructive or irreversible actions. If a task needs a real-world fact, mark it **Pending owner** on the board and move on.

## 7. Escalation

Tell the owner only for: a verified milestone, a blocker, or a decision that needs a real-world fact or crosses a boundary. Do not send messages just to say nothing changed.
