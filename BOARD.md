# AZAL — Task board and file claims

Updated by whoever works. See `COORDINATION.md` for the rules. Last organized: 2026-11-25 (Toronto).

## Claims (file locks)

| File | Owner | Task | Since (Toronto) | Notes |
|---|---|---|---|---|
| none | | | | All claims released after Sufra Compass v1 (see `CHATGPT-REPLY.md`). Branch `claude/c8-language-fix` holds a one-line C8 fix awaiting merge once Muse's current QA pass ends. |

## Open tasks

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| C8 | EN/FR switch does nothing | ChatGPT merges, Muse re-QAs | **Fix on branch `claude/c8-language-fix`** | Root cause found on `main` (line 81 of `script.js`): `document.document.documentElement.dir="ltr"` throws a TypeError inside `applyLanguage()`, so no translation runs. `node --check` cannot catch it because it is a runtime error. The branch changes that one line to `document.documentElement.dir="ltr"`. Muse independently confirmed the typo in the actual file (2026-11-25 ~19:40 EST) and gave the merge go-ahead in MUSE-REPLY.md — merge once the in-flight Sufra QA run lands; after merge + Pages deploy, Muse re-runs the full EN↔FR QA. Earlier "cache-busting" diagnosis missed this. |
| C9 | Header "YOUR ORDER" button wraps to two lines, badge overlaps text | ChatGPT | Open | `styles.css`. Add `white-space:nowrap`, check mobile header. |
| C6 | Four wrong dish photos: Hummus (shows a chocolate drink), Fahsa (rice plate), Mango Juice (assorted smoothies), Adeni Chai (clear tea with bag) | ChatGPT + Muse | Open | Replace only with images whose source and rights are clear. Keep them labelled as illustrative. |
| C7 | Card button stays "Added ✓" after removing the item from the cart drawer | Muse to re-test | Needs re-test | Current `main` re-renders products after a cart change, so this may already be fixed. Reproduce on the live URL before changing anything. |
| M1 | Favicon visual check in a real browser tab | Muse | Open | File exists on the server. Visual check pending. |
| A1 | Arabic wordmark "أَزَال" shows as boxes in the QA browser | Muse | Open | Likely a missing font in the QA environment. Verify on a real device. |
| S1 | Sufra Compass v1 prototype | Muse | Built, awaiting QA and critique | Pushed with CI "Site checks" passing. Muse to QA EN↔FR, guide buttons, search, tabs, keyboard, reduced motion, and critique the three labels. |
| B1 | Brand-experience brief: Majlis AZAL, community content, multi-branch model | ChatGPT drafts, Muse reviews | Open | What is live now, what is visibly "Phase 2", what must never be faked. |

## Pending owner (real-world facts, do not guess)

- Final menu, prices and dish photography.
- Address, phone, opening hours, social accounts.
- Rules for rewards and points before any real transaction exists.
- Which supplied images are approved for publishing.

## Done

| ID | Task | Commit |
|---|---|---|
| C1 | Hardened `script.js` render and event wiring | see `CHATGPT-REPLY.md` |
| C2b | Menu images converted to `img` with lazy loading | e051d49, 7d76e0e |
| C3 | French draft copy `fr-draft.md` | see `CHATGPT-REPLY.md` |
| I1 | Innovation ledger `IDEAS.md` | 4a0fe41 |
| CI1 | GitHub Actions "Site checks" workflow | c1dff35 |
