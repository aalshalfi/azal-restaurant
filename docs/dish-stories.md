# Dish stories (task 4) — Claude, 2026-11-25

Purpose: one region + one honest line per sample dish, EN and FR, for the Menu page (under the dish name, small, optional "story" line). Written from widely documented culinary tradition, deliberately modest: no dates, no claims of being "the original", no awards, no family or restaurant history (that is the owner's to supply).

**Status: DRAFT for owner or kitchen review.** Dish names and sample prices on the site stay illustrative. The owner or chef should correct any line that does not match how AZAL cooks the dish; where the kitchen differs, the kitchen wins. Arabic wordmark/names are not added here (owner-approved spellings are Tier C).

Style rules: one sentence, max ~22 words, warm and plain, no superlatives, FR written natively (not word-for-word). Each line fits one line at 390px when wrapped to two.

| # | Dish (site name) | Region | EN story | FR histoire |
|---|---|---|---|---|
| 1 | Lamb Mandi / Mandi d’agneau | Hadramaut, south-east Yemen | Born in Hadramaut: lamb and rice cooked together, the meat's juices falling into the fragrant rice below. | Née dans l’Hadramaout : l’agneau et le riz cuisent ensemble, les sucs de la viande parfumant le riz en dessous. |
| 2 | Chicken Mandi / Mandi au poulet | Hadramaut | The same slow, smoky mandi method, lighter with chicken and a favourite for sharing. | La même cuisson lente et fumée du mandi, plus légère avec le poulet, idéale à partager. |
| 3 | Lamb Haneeth / Haneeth d’agneau | Hadramaut and the south | Lamb roasted slowly in a sealed oven until it falls off the bone, seasoned simply so the meat speaks. | Agneau rôti lentement en four fermé jusqu’à ce qu’il se détache de l’os, assaisonné simplement pour laisser parler la viande. |
| 4 | Yemeni Fahsa / Fahsa yéménite | Sana’a and the northern highlands | A shredded-meat stew served sizzling in a stone pot, eaten by scooping it up with warm bread. | Un ragoût de viande effilochée servi bouillant dans une marmite en pierre, à saisir avec du pain chaud. |
| 5 | Yemeni Saltah / Saltah yéménite | Sana’a and the highlands | Often called Yemen’s national dish: a bubbling stew topped with whipped fenugreek, the table’s centrepiece. | Souvent appelé le plat national du Yémen : un ragoût mijoté couronné d’une mousse de fenugrec, au centre de la table. |
| 6 | Sahawiq & Fresh Bread / Sahawiq et pain frais | All of Yemen | A fresh chilli, tomato and garlic relish that sits beside nearly every Yemeni meal, made for tearing bread into. | Une sauce fraîche de piment, tomate et ail présente à presque tous les repas yéménites, faite pour y tremper le pain. |
| 7 | Hummus / Houmous | Shared across the Levant and beyond | A dish many cuisines share, here a gentle starter to the table beside the Yemeni plates. | Un plat que se partagent bien des cuisines ; ici, une entrée douce aux côtés des plats yéménites. |
| 8 | Adeni Chai / Thé adéni | Aden, the port city | Aden’s tea: strong black tea with milk and warm spices, the way the port city starts and ends a meal. | Le thé d’Aden : un thé noir corsé au lait et aux épices douces, comme on commence et finit un repas dans la ville portuaire. |
| 9 | Fresh Mango Juice / Jus de mangue frais | Tihama, the Red Sea coast | Mangoes ripen along Yemen’s Red Sea plain, the Tihama, and are pressed into a cool, sweet drink. | Les mangues mûrissent sur la plaine côtière de la mer Rouge, la Tihama, et deviennent une boisson fraîche et douce. |

## Notes for review
- Row 7 is honest on purpose: hummus is not uniquely Yemeni and the site should not pretend it is.
- Row 5 uses "often called", a widely repeated description, not our own claim.
- Rows 1–3: methods described in general (rice and meat cooked together; sealed-oven roasting). If AZAL's kitchen uses another method (pot, oven, grill), the owner edits the line and I adjust the FR.
- Ingredient and allergen statements are NOT made here (fenugreek, milk, nuts, sesame in hummus/tahini). Allergen information is a real-world fact and a legal gate: listed in `docs/launch-gates.md` as Pending owner.

## Build notes for ChatGPT
- Add keys `story_<id>` to `translations`/`productTranslations` (EN and FR); render one muted `<p class="dish-story">` under the description on the Menu page; size 14px minimum (typography floor 12px, body 16px), colour `--muted:#6B5848`.
- Do not show the story in the cart. Keep it out of the card on Home except the signature dishes strip if height allows.
- Test: every dish id 1–9 has a non-empty story in both languages (add to `tests/smoke.test.mjs`).
