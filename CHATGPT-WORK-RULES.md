# CHATGPT WORK RULES — v1.1

Issued by the lead (Muse) on the owner's order, 2026-11-27. These rules govern how ChatGPT works on the AZAL project. They are distilled from this project's own record — every rule exists because a real incident taught it. They bind alongside TEAM-DIRECTION.md, BUILD-METHOD.md and the professional-work standard; where they overlap, the stricter line wins. The lead amends this file by versioned note; ChatGPT may propose amendments in CHATGPT-REPLY.md, never self-adopt them.

## Evidence before words
1. **No claim without a commit.** If it is not in the repository, it did not happen. Every status statement names the branch and the exact head SHA it describes.
2. **Every delivery carries its NOT-verified line.** What was not run, not seen, or not proven is stated explicitly — silence about a gap reads as a claim that it was checked.
3. **A test that cannot fail is not a test.** When you add or repair an assertion, prove it executes: the run record shows it failing when it should fail, or the runner fails loudly on any error. (Origin: a redemption assertion that silently never ran while the suite showed PASS.)

## One record, one delivery
4. **One delivery branch per card.** Work that spawns parallel copies is consolidated by YOU before the gate — the lead never receives three branches and a riddle. Superseded PRs are closed by you, unmerged, in the same note that names the surviving one.
5. **Sync by real merge only.** Merge main into your branch; never rewrite history, never force-push a shared branch. After every sync, re-run the full verification on the NEW head — evidence from a previous head is void.
6. **Every round ends in the repository.** A saved edit with a commit, or a status note in CHATGPT-REPLY.md stating what was done, what is blocked, and the single next step — so anyone can resume you with one prompt. A round is never "finished" by chat text alone.

## Read before you act
7. **Re-read the record at the current head.** Before acting on any lead note or card, read the governing files from main as they stand NOW, and name the head you read. If a file reads empty or stale against what the conversation says, STOP and report the mismatch — never proceed on a copy you cannot trust. (Origin: an activation acted on from an empty file copy.)
8. **Check every channel addressed to you.** Each round: CHATGPT-REPLY.md answers owed, GitHub Issues, and PR comments naming you. A critique is answered publicly, line by line — never silently fixed. (Owner's standing rule.)
9. **Search before you propose.** Before offering any idea or design, search SPEC.md, IDEAS.md, docs/creative-sprint.md and BOARD.md for prior art. Cite what you checked. An idea already built, parked, or rejected is not re-proposed as new.

## Craft
10. **A gap is reported, never improvised around.** If a card or schema cannot support what was asked, stop at the gap and file a lead decision request with your proposed solution and its rails — exactly as the T-08 email gap was handled. That round is the model.
11. **Study the whole surface before touching it** (BUILD-METHOD §6). Sibling defects inside your card's spirit and risk class are fixed in the same batch; the rest are reported as named findings. A point-fix that leaves a sibling defect for the owner to find is a failed delivery.
12. **Find one yourself.** Every batch carries at least one defect or polish item you found by walking the work as its user — not assigned by anyone. (Proactive mandate.)

## Push discipline
14. **Batch your pushes.** Every push runs CI, and every failed run emails the owner personally. Run everything runnable in your environment BEFORE pushing; fix a failing job in ONE consolidated push per cycle — never a drip of micro-pushes chasing one test. If a job can only run in CI, say so in the round note and still consolidate. (Origin: ~115 failure emails to the owner in one night, 2026-11-28, from a push-fix-push cycle on a single browser test.)

## Growth loop
13. **Three-line retrospective after every gated card**, in CHATGPT-REPLY.md: what the gate caught that you missed · what you will check first next time · one rule you would amend and why. The lead folds recurring lessons into this file at the next version — your rules improve because your record does.

## Pre-delivery self-check (all must be true before posting READY FOR LEAD GATE)
- [ ] Branch is the single named delivery branch, synced with main by merge; head SHA stated in full.
- [ ] Node suite, browser suites, and SQL behaviour runs all executed on THIS head, with their result lines quoted.
- [ ] Every new string exists in EN, FR and AR in the same commits.
- [ ] File claims on BOARD.md match the files actually touched.
- [ ] NOT-verified line present. Retrospective scheduled.
- [ ] No questions to the owner; undecided points are filed to the lead, not left as stops.

— Muse (team lead), v1.0, 2026-11-27 · v1.1 (rule 14, push discipline) 2026-11-28
