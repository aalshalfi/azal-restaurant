# AZAL creative sprint: challenge everything (Claude, 2026-11-26 13:15 EST)

**Owner directive (13:13, binding):** stop routine work and pull dependent work into one joint creative push. Challenge what has been built and propose and build features nobody else has. Hold each other to the highest bar.

**What doesn't change:** we still invent no facts (address, hours, menu, reviews), collect no real data or money without the gate, keep the logo and palette, and do nothing destructive.

## 1. The hard truth about what we have built
We have built a *competent* restaurant site: menu, cart, pickup slots, test payments, table booking, points. **Every serious restaurant has that.** Nothing yet makes a guest say "I've never seen a restaurant do that." Our real asset is not the stack. It is **Yemeni hospitality (karam)**, the majlis, sharing one big tray, the timing of the oven and of iftar. The site currently *describes* that culture; it does not *behave* like it.

My own challenges to our current work:
1. **The menu is a grid of cards like every delivery app.** Yemeni food is ordered *as a sufra for the table*, not item by item.
2. **Pickup slots are cold clock times.** In a Yemeni kitchen the clock is the bread oven and the mandi pit.
3. **Points are a number.** They should feel like being a regular in someone's home.
4. **The site speaks English and French, but not Arabic,** the language of the food and of many of our first guests.
5. **The year has a heartbeat we ignore:** Ramadan. For a Yemeni restaurant in Ottawa it is the busiest and most emotional month, and the site has no idea it exists.

## 2. Ten bold ideas (ranked by guest impact ÷ effort)
| # | Idea | Why no one else has it | What the guest gets | Build needs |
|---|---|---|---|---|
| 1 | **Iftar Mode:** during Ramadan the whole site turns to dusk. A live countdown to *today's Ottawa sunset* (computed in the browser, astronomically), "Order for iftar" pre-selects the pickup slot just before sunset, and there are suhoor reminders. | Restaurants post a static "Ramadan hours" image; nobody computes iftar live per day and ties it to ordering. | Food in hand at the minute of iftar, with no mental arithmetic. | **None. Building now (prototype).** Ramadan dates from the browser's Umm al-Qura calendar; a note that local moon sighting can differ by a day. |
| 2 | **Jam'a (group tray link):** one person starts a sufra and shares a link; friends add their dishes from their own phones; one person pays. | Group ordering exists in corporate tools, but not as a family tray with a host. | Ordering for a family or a mosque group without passing a phone around. | Schema 0006 (shared cart, host-pays), owner OK. |
| 3 | **Arabic (العربية), right to left,** as a third language. | Ottawa restaurants are EN/FR at most. | Elders and new arrivals order in their own language. | Owner OK on adding a 3rd language. I write the copy; an RTL layout pass. |
| 4 | **"I'm outside" button:** after paying, one tap tells the kitchen screen "Sara is outside, blue car". | Curbside exists for big chains, not small restaurants, and not tied to a live kitchen ticket. | Hot bread handed to the car window. | A small 0007 function plus a staff-screen badge. |
| 5 | **The Kitchen Clock:** the confirmation becomes a live ticket (Received → On the fire → Ready) driven by the staff screen. | Uber-style tracking, but for pickup at a family restaurant. | Leave home at the right minute. | Already 90% there (staff screen + polling). |
| 6 | **Sitti's three questions:** "How hungry? How spicy? How many?" leads to one complete tray, added to the cart in one tap. | No "AI" gimmick: three honest taps over our real menu. | First-timers stop staring at unfamiliar names. | Client-only, built on the sample menu. |
| 7 | **A map of Yemen on the Story page:** tap Hadramaut → mandi, Sana'a → saltah, Aden → chai. Each region lights up and links to its dish. | Turns "about us" into a 20-second trip. | Understands what they are eating and where it is from. | Client-only SVG; general knowledge only, nothing invented about AZAL. |
| 8 | **The Majlis as a house, not a points table:** a visit becomes a cushion in your majlis (cup 1, 2, 3…). The points still exist, shown as hospitality. | Loyalty with a cultural metaphor instead of a number. | Feels like being remembered. | Front-end on the existing ledger; owner OK on the metaphor. |
| 9 | **Oven-live freshness:** "Bread out of the tannour at 12:00, 13:30, 18:00". Pick the slot that matches. | We already have a fresh-from-oven preview. Make it the *primary* way to pick a time. | Hottest bread, by design. | Real oven times from the owner (Tier C). |
| 10 | **Host stand on a tablet:** one screen for the night with bookings, walk-ins, seats left, and pickup orders arriving. | Small restaurants juggle three apps. | Faster seating, fewer mistakes. | Combines staff.html with reservations. |

## 3. What I am building right now
**Iftar Mode (idea 1): BUILT, PR #35 (`claude/iftar-mode`), tests 11/11 in the browser.** Inert outside Ramadan; it can be previewed with `?iftar=preview`.
- **Ramadan detection:** `Intl.DateTimeFormat` with the `islamic-umalqura` calendar (built into every modern browser). There is no hard-coded date.
- **Sunset for Ottawa (published-table reference point):** the NOAA solar-calculator equations, computed in the browser and DST-safe. Within 2 minutes of published Ottawa tables, **plus a 2-minute safety margin, so the shown iftar is never before published sunset** (tested on 8 dates).
- **UI:** a dusk banner, "Iftar in 2 h 14 min · sunset 4:41 pm", and an "Order for iftar" button that opens the cart with the latest pickup slot at or before sunset pre-selected. EN/FR.
- **Honesty line:** "Sunset is calculated for Ottawa; dates follow the Umm al-Qura calendar, so local announcements may differ by a day."

## 4. Challenges to the team (please answer in your reply files)
- **@ChatGPT:**
  - Attack my ranking. Which of the 10 is weakest, and what is your better idea?
  - You own UX review, so pick **one** idea and produce the phone-first screen spec today.
  - Tell me if Iftar Mode feels respectful and not like a marketing gimmick, and what would make it more so.
- **@Muse:**
  - As the gate, which of these could ship **before Ramadan 2027 (≈ Feb 8)** without breaking a launch gate?
  - Name the one you would kill.
- **To all:** every idea needs three things: what it is, why it is new, and what the guest gets. No copying another brand. No invented facts. A bold idea that breaks a boundary is not bold; it is a mistake.

## 5. Owner decisions needed (short)
1. Add **Arabic** as a third language? (yes / no)
2. **Jam'a group tray:** build the schema? (yes / no)
3. **Majlis as a house:** use that metaphor for points? (yes / no)
4. **Real oven times** for idea 9, when the kitchen knows them.

## 6. DECISION RULE (owner, 13:26, binding): the team votes, then builds
- **Nothing goes to the owner for product, feature or design choices.** Questions, confirmations and approvals for such choices are forbidden.
- **The vote:** each model votes on every open option with one line of reasoning. Majority wins immediately. On a tie, the lead (Muse) decides. The result is binding, and building starts at once.
- **The only things that may go to the owner:** a technical blocker that actually stops work, or a financial or security action that needs him personally.
- **This replaces §5 of this doc.** My questions there are withdrawn and converted into the votes below.
- **Real-world facts stay out of voting.** We never vote on facts such as oven times, the address or prices. They keep their labelled examples, and the real values arrive when the kitchen sets them.

## 7. OPEN VOTES. Ballots are cast in your own reply file, as `V1: yes/no — reason`
| ID | Option | Claude | ChatGPT | Muse | Result |
|---|---|---|---|---|---|
| V1 | Add **Arabic (العربية, RTL)** as a third language | **YES**: the food's own language and many first guests'. No other Ottawa restaurant has it. Reversible. | | **YES**: the food's own language; reversible, client-only; merge only through the Tier-B gate. | **YES 2–0 — binding (Muse 13:35)** |
| V2 | Build **Jam'a group tray** (shared link, friends add dishes, one host pays) | **YES**: the purest digital form of the sufra, a real ordering edge, and the existing 0004 rules carry it. | | **YES in principle**: approves the option, not immediate build — sequencing stays after the launch gates (schema 0006 + privacy/abuse design). | **YES 2–0 in principle — binding (Muse 13:35); build after launch gates** |
| V3 | Show Majlis points as **hospitality** (cups and cushions, with the number kept underneath) | **YES, with the number always visible.** It adds warmth without hiding value. | | **YES, with the number always visible** (Claude's condition adopted). | **YES 2–0 — binding (Muse 13:35)** |
| V4 | Next prototype after Iftar Mode: (a) map of Yemen · (b) Sitti's three questions · (c) "I'm outside" button | ~~(b)~~ **(a) map of Yemen.** I attacked my own idea: (b) mostly duplicates the shipped "Pick a mood" compass and "Sufra for N". The map is new, and it is BUILT (PR #36). | | **(a) map of Yemen**: the self-challenge is sound — Sitti's duplicates shipped features; the map is built and lead-verified 103/103. | **(a) map 2–0 — binding (Muse 13:35)** |
| V5 | Iftar Mode PR #35: merge when review passes (yes/no) | **YES** | | **YES**: conditioned on ChatGPT CX @ `ba67e7f` + Muse live QA; no merge before that. | **YES 2–0 — binding (Muse 13:35)** |

**To keep momentum:** where my vote is YES, I start building on a separate branch immediately, which is reversible. Nothing merges until the vote has a majority. If a vote goes against my branch, I close it.

## 8. Sprint scoreboard (Claude, 15:15)
| Idea | Status |
|---|---|
| Iftar Mode | **Built**, PR #35 @ `a098d45`. CX fixes done; waiting for re-review and Muse QA. |
| Map of Yemen | **Built**, PR #36 @ `7feca81`. CX fixes done. |
| Arabic (V1) | **Built**, PR #37 @ `73dcdd5`. Copy polished. |
| Table Pulse (= Kitchen Clock) | **Built**, PR #38 (stacked on #29), to ChatGPT's spec. |
| Sitti's three questions | **Cut**: duplicates the shipped features (agreed by all three). |
| Sufra Composer | **Cut** as a separate flow; appetite may fold into Sufra for N. |
| Host stand | Killed for this sprint (lead). |
| Jam'a | YES in principle; after the launch gates (schema 0006 + privacy/abuse design). |
| Majlis as hospitality (V3) | **Built**, PR #39 (stacked on #29): one qahwa cup per collected order, number always visible. |
| Bread Clock (V6, YES 2–0) | **Built**, PR #40. |
| Sufra share card (V7) | **Built**, PR #41 (ballots pending; no merge without a majority). |
| "I'm outside" | After the gates (small function + staff badge). |
| Oven-live | Blocked on real kitchen times (a fact, not a vote). |


## 9. New votes V6–V7 (Claude, 16:25). Ballots go in your reply files
**V6. "Bread Clock" on the menu, with no invented times.** The tannour bread is the soul of a Yemeni table, and on our menu it is just one line, "Sahawiq & Fresh Bread". The idea is a quiet line on each dish that is eaten with bread (fahsa, saltah, sahawiq): "Best with bread straight from the oven. Ask for it hot at pickup." Plus one "How to eat it" micro-animation: three frames (tear, scoop, eat) in CSS only, reduced-motion safe.
- *Why new:* menus list bread as a side; nobody teaches the guest the one gesture that makes the meal.
- *Guest gain:* a first-timer eats fahsa the right way on the first try.
- *Facts:* none new. The scoop-with-bread gesture is already in our own dish stories.
- *Claude: YES.*

**V7. "Sufra share card": a picture of your order to send the family.** After a test-mode order (or from the cart), one tap makes a clean image of the tray, with dish names in EN/FR/AR and the pickup time. It is built on a `<canvas>` in the browser and shared with the phone's own share sheet (Web Share API), falling back to a download.
- *Why new:* group orders in Yemeni families are coordinated in WhatsApp groups; restaurants send links, not a tray picture people actually look at.
- *Guest gain:* "here's what I ordered, add anything?" in one tap, with no account and no data sent anywhere.
- *Facts:* none. It uses only the cart and the sample menu; nothing leaves the phone unless the guest shares it.
- *Claude: YES.* Client-only.

**V6 result: YES (Claude + ChatGPT 16:55): binding.** PR #40, waiting its turn after the owner's critical queue. **V7: open.**

**Build rule:** I start V6 (smaller, client-only) on `claude/bread-clock` now. V7 starts only after V6 or if V7 wins a vote first. A NO majority closes the branch.

## 10. Muse's open questions, answered
- **#38:** explicit non-paid handling, not a paid filter in `byId`: the guest sees *why* the order is no longer active.
- **F-A:** Amiri (SIL OFL), subset to the Arabic block, bundled as "AZAL Arabic". It covers the toggle's «ع» (U+0639 is inside the subset; the toggle's font stack lists it). Verified in the headless QA browser: the font loads and renders on the Arabic page, and it is not requested on EN pages (unicode-range).

## 11. Owner annex 19:18: friction first, novelty filter, Claude breaks ties (Claude, 19:25)

### 11.1 Friction audit: found in our own code, not from templates
| # | Where (file) | Friction today | Verdict |
|---|---|---|---|
| F1 | `checkout.js` L233, `staff.js` L9 | The pickup code is the first 6 hex characters of a UUID ("3F9A0C"). Hard to say aloud, 0/O and 8/B get confused, and it means nothing in Arabic or French. | → **V8** |
| F2 | `staff.js` L95 | Staff find the bag by calling out the guest's name across the counter. That is a privacy leak, and Arabic names are often mangled. | → **V8** |
| F3 | ordering 0004: the slot drives the kitchen | Bread is fired for the *slot*, not the *arrival*. A guest 10 minutes late gets cold khubz, and an early one waits. | → **V9** |
| F4 | `script.js` cart in localStorage | A returning member rebuilds last week's tray by hand. | "Reorder" is a common feature, so it is **rejected by the filter** |
| F5 | `staff.js` slot groups | The baker cannot see how much bread a slot needs across orders. | "All-day" item roll-ups are standard in kitchen-display software, so it is **rejected by the filter** |

### 11.2 V7 tie-break (rule 12: Claude decides ties)
The standing is 1–1 (Claude YES, ChatGPT NO). **Decided: YES.** ChatGPT's three concrete objections are fixed at `cebcc7a`:
- the card is a draft with no pickup time;
- French is tested;
- cancel and fallback are tested.

The feature is client-only and reversible. I am the author, so this conflict of interest is stated openly. Muse has not voted yet: if Muse casts a ballot, the result becomes a 2–1 majority either way and replaces this tie-break. Merging still goes only through the gate.

### 11.3 V8 "Pickup sigil": a code you can say in any language (fixes F1 and F2)
- **What:** The hex code is replaced by an icon plus a word plus a number derived from the same order id, for example **🌙 Moon 42 · Lune 42 · قمر 42**. The guest's confirmation and the staff ticket compute the same sigil from the same id (`sigil.js`), so there is no schema change. The hex code stays in small print underneath, the same rule as V3.
- **At the counter:** the staff ask "Moon 42?" instead of shouting a name. The icon matches even when the guest and the cook speak different languages.
- **Collisions:** there are 16 icons × 90 numbers = 1,440 sigils. If two *active* orders on the staff screen share one, both tickets are flagged "same sigil: check the code", and the hex code becomes large.
- **Why new:** pickup counters use numbers or names. A spoken trilingual token with a universal icon, deterministic on both screens, is not something restaurant sites do.
- **Guest gain:** no spelling a name at the counter, nobody hears who you are, and it works for an elder who speaks only Arabic.
- **Self-critique (hard):**
  - (a) Emoji render differently on the staff tablet and the phone. *Mitigation:* the word and the number carry the meaning; the icon is only a helper.
  - (b) Collisions at 1,440. *Mitigation:* the staff screen detects them, with a test.
  - (c) Does it add a step for the guest? No, it replaces the code, so the step count does not change.
  - (d) "Cute but useless"? It removes a real error source (hex read aloud) and a real privacy leak.
- **Build:** stacked on #29 (`checkout.js` and `staff.js`), branch `claude/pickup-sigil`. No merge without a majority. **Claude: YES.**

### 11.4 V9 "Bread fired to your arrival" (fixes F3)
- **What:** the order-status screen (Table Pulse) gets one optional button, **"Leaving now"**. The staff ticket then shows "arriving ≈ 18:42 · fire bread 18:35", using the travel minutes the guest chose (5, 10, 15 or 20). No location is collected.
- **Why new:** curbside "I'm here" is an arrival signal. This is a *departure* signal that drives the oven, built for a bread-first cuisine.
- **Guest gain:** bread that is hot when you walk in, even if you are late.
- **Self-critique:**
  - It adds one optional tap, which rule 6 is wary of. *Kept optional and hidden after the slot passes.*
  - It needs a small 0007 function, so it comes **after the launch gates**.
  - The bread lead time is a kitchen fact (Tier C), so it is labelled as an example until the owner gives it.
- **Claude: YES in principle, build after the gates.**

**Ballots:** @ChatGPT and @Muse, cast V8 and V9 in your reply files with a one-line reason. Critique first and hard; the novelty filter applies to my ideas too.
