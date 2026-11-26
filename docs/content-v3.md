# AZAL content v3 — every string, EN + FR (Claude, content lead, 2026-11-26)

Scope: Muse's content order (23:05). Each row is keyed to its page and its existing i18n key in `script.js`, so ChatGPT can integrate by replacing values. **New** marks a key that does not exist yet. Dish stories live in `docs/dish-stories.md` (keys `story_1`…`story_9`, already approved as draft copy).

## Writing rules used
- Short, specific, warm. No filler words ("exceptional", "like no other", "something special"). A sentence earns its place by telling the guest something true or useful.
- French written in French: natural word order, Canadian usage where it matters ("à emporter", "courriel"), before `: ; ? !` put a non-breaking space (U+00A0) directly in the FR string, so no render logic is needed (Muse FR gate 23:15).
- No invented facts: no city, address, founding year, founder biography, awards or reviews. Where a real fact belongs, the copy holds a **{placeholder}** and the fact is listed in "Pending owner" at the end. Until filled, ChatGPT renders the fallback line given in the row.
- Demo notices stay while the site is a preview (CLAUDE.md rule 6). Each demo string has a **launch** version beside it, so switching to real ordering is a value swap, not a rewrite.
- Hero headline: the current "A Taste of Yemen, Like No Other" is a generic superlative and repeats in the footer. Replaced below.

---

## Shared (all pages)

| Key | EN | FR | Note |
|---|---|---|---|
| navHome | Home | Accueil | |
| navMenu | Menu | Menu | |
| navStory | Our story | Notre histoire | sentence case, matches the rest |
| navVisit | Visit | Nous trouver | shorter EN |
| navMajlis | Majlis | Majlis | one word; the page explains it. Sign-in label lives on the page, not the nav (frees header width at 390px) |
| **navReserve** (new) | Reserve | Réserver | add when R1 goes live |
| cartButton | Your order | Votre commande | |
| stickyCartLabel | View your order | Voir la commande | |
| footerTagline | Yemeni food, made to share. | La cuisine yéménite, faite pour être partagée. | replaces the duplicated hero line |
| footerLegal | AZAL · Yemeni restaurant · Preview site | AZAL · Restaurant yéménite · Site en aperçu | launch: `AZAL · Yemeni restaurant` / `AZAL · Restaurant yéménite` |
| photoCreditsLabel | Photos are illustrative, not AZAL’s own. Credits: | Photos d’illustration, ne provenant pas d’AZAL. Crédits : | delete at launch with real photos |

## Cart and checkout (shared)

| Key | EN (preview) | FR (preview) | EN launch | FR launch |
|---|---|---|---|---|
| cartKicker | YOUR ORDER | VOTRE COMMANDE | same | same |
| cartTitle | For pickup | À emporter | same | same |
| subtotal | Subtotal | Sous-total | same | same |
| cartDisclaimer | Preview only: nothing is sent or charged. | Aperçu seulement : rien n’est envoyé ni facturé. | Tax is added at checkout. | Les taxes sont ajoutées au paiement. |
| checkoutButton | Continue | Continuer | Choose a pickup time | Choisir l’heure de retrait |
| demoOnly | PREVIEW | APERÇU | (remove) | (retirer) |
| checkoutTitle | Almost there. | Presque prêt. | Almost there. | Presque prêt. |
| checkoutText | This preview does not send your order to the kitchen or take payment. | Cet aperçu n’envoie pas votre commande en cuisine et ne prélève aucun paiement. | Check your order, pick a time, and we start cooking when you confirm. | Vérifiez votre commande, choisissez l’heure, et nous commençons dès votre confirmation. |
| demoPickupOnly | No name, time or payment details are collected here. | Aucun nom, horaire ni paiement n’est recueilli ici. | (remove) | (retirer) |
| placeDemo | See the preview | Voir l’aperçu | Confirm order | Confirmer la commande |
| add | Add | Ajouter | | |
| added | Added | Ajouté | the ✓ icon stays as a separate `aria-hidden` span |
| noResults | No dish matches that. Try another word or show all dishes. | Aucun plat ne correspond. Essayez un autre mot ou affichez tous les plats. | |
| emptyCart | Nothing here yet. The menu is a good place to start. | Rien pour l’instant. Le menu est un bon point de départ. | |
| each | each | chacun | "l’unité" reads like a price list |
| removeOne | Remove one | En retirer un | |
| addOne | Add one | En ajouter un | |
| thankYou | Preview | Aperçu | launch: `Thank you` / `Merci` |
| demoContains | Your order would include | Votre commande comprendrait | launch: `Your order` / `Votre commande` |
| items | item(s) | article(s) | better: plural-aware keys `item_one`/`item_other` |
| notSent | Nothing was sent to the restaurant. | Rien n’a été envoyé au restaurant. | launch: `Order {code} confirmed. Pickup at {time}.` / `Commande {code} confirmée. Retrait à {time}.` |
| **cartLive** (new, aria-live) | Added to your order: {dish}. | Ajouté à votre commande : {dish}. | for the required `role="status"` announcement |
| **cartLiveRemoved** (new) | Removed from your order: {dish}. | Retiré de votre commande : {dish}. | |

---

## Home (`index.html`)

| Key | EN | FR | Note |
|---|---|---|---|
| heroEyebrow | YEMENI KITCHEN · PICKUP & TABLES | CUISINE YÉMÉNITE · À EMPORTER ET SUR PLACE | says what the place does |
| heroTitle | Slow-cooked Yemen, | Le Yémen, mijoté lentement, | |
| heroTitleEm | shared at your table. | partagé à votre table. | |
| heroText | Mandi from Hadramaut, saltah from Sana’a, chai from Aden. Order ahead for pickup, or come and sit with us. | Le mandi de l’Hadramaout, la saltah de Sanaa, le thé d’Aden. Commandez à l’avance ou venez vous asseoir avec nous. | concrete; while preview, the second sentence is fine: nothing is promised as live |
| heroMenu | See the menu | Voir le menu | |
| heroStory | Our story | Notre histoire | |
| sampleNote | PREVIEW · DISHES AND PRICES ARE EXAMPLES | APERÇU · PLATS ET PRIX DONNÉS À TITRE D’EXEMPLE | remove at launch |
| signatureKicker | WHERE TO BEGIN | PAR OÙ COMMENCER | |
| signatureTitle | Three dishes, three regions. | Trois plats, trois régions. | ties to the dish stories |
| signatureIntro | A first taste of the menu. Each dish comes from a different corner of Yemen. | Un premier aperçu du menu. Chaque plat vient d’une région différente du Yémen. | |
| signatureLabel | EXAMPLE DISH | PLAT D’EXEMPLE | remove at launch |
| signatureMandi | Lamb mandi | Mandi d’agneau | |
| signatureMandiText | Hadramaut · lamb and rice cooked together, slow and smoky. | Hadramaout · agneau et riz cuits ensemble, lentement, au goût fumé. | |
| signatureFahsa | Fahsa | Fahsa | |
| signatureFahsaText | Sana’a · a meat stew that arrives sizzling in a stone pot. | Sanaa · un ragoût de viande servi bouillant dans une marmite en pierre. | |
| signatureChai | Adeni chai | Thé adéni | |
| signatureChaiText | Aden · black tea, milk and warm spice. | Aden · thé noir, lait et épices douces. | |
| storyKicker | THE IDEA | L’IDÉE | |
| storyTitle | In Yemen, a guest | Au Yémen, un invité | |
| storyTitleEm | is never served alone. | n’est jamais servi seul. | cultural truth about shared platters, not a claim about AZAL |
| storyText | Yemeni meals come on large plates in the middle of the table, and everyone reaches in. AZAL is built around that habit: dishes made to be shared, and a room where you can stay a while. | Au Yémen, les plats arrivent au centre de la table et chacun se sert. AZAL est né de cette habitude : des plats faits pour être partagés, et un lieu où l’on prend son temps. | |
| storyTeaserLink | Read our story | Lire notre histoire | |
| visitKicker | VISIT | NOUS RENDRE VISITE | |
| visitTitle | Come and eat with us. | Venez manger avec nous. | **single key**: delete `visitTitle2` and `you` (the FR `you = "."` hack breaks in other languages) |
| visitText (preview) | We are getting ready to open. The address and phone number will be posted here once confirmed. | Nous préparons l’ouverture. L’adresse et le téléphone seront publiés ici dès qu’ils seront confirmés. | launch: `Order ahead for pickup or book a table. Walk-ins welcome when there is room.` / `Commandez à emporter ou réservez une table. Sans réservation, selon les places disponibles.` |
| visitCard | AZAL | AZAL | |
| visitCardTitle | One room, | Une salle, | |
| visitCardTitle2 | fifty seats. | cinquante places. | owner fact (22:37, 50 seats); Muse recorded it. Keep only if the owner is happy to show it publicly |
| locationLabel | Where | Où | |
| toAnnounce | Address coming soon | Adresse à venir | |
| addressLabel | Phone | Téléphone | the old pair used Location + Address for one empty fact; use Where + Phone |
| comingSoon | Coming soon | À venir | |
| hoursLabel | Hours | Heures | |
| **hoursValue** (new) | Daily, 11 am – 9 pm | Tous les jours, 11 h – 21 h | owner gave 11–21; "daily" is Muse's provisional 7-day default: **show only after the owner confirms days** (else show `comingSoon`) |

---

## Menu (`menu.html`)

| Key | EN | FR | Note |
|---|---|---|---|
| **menuH1** (new, visually hidden h1 already merged) | AZAL menu | Menu AZAL | |
| menuKicker | THE MENU | LE MENU | |
| menuTitle | Made to | Fait pour | |
| menuTitleEm | share. | être partagé. | |
| menuIntro (preview) | Dishes and prices are examples while we prepare to open. Ordering is not live yet. | Les plats et les prix sont des exemples en attendant l’ouverture. La commande n’est pas encore active. | launch: `Order ahead for pickup. Most dishes serve one; rice platters are easy to share.` / `Commandez à emporter. La plupart des plats sont pour une personne ; les plateaux de riz se partagent facilement.` (the second sentence needs kitchen confirmation) |
| demoLabel | EXAMPLE MENU · EXAMPLE PRICES | MENU D’EXEMPLE · PRIX D’EXEMPLE | remove at launch |
| sufraKicker | NOT SURE WHERE TO START? | VOUS HÉSITEZ ? | |
| sufraTitle | Pick a mood, | Choisissez une envie, | |
| sufraTitleEm | we’ll point the way. | on vous guide. | |
| sufraIntro | Three easy ways into the menu. | Trois façons simples d’entrer dans le menu. | |
| sufraDemo | (delete) | (supprimer) | a second demo badge on the same page is noise; `demoLabel` covers it |
| sufraGroup | Ways into the menu | Façons d’entrer dans le menu | aria label |
| sufraWarm | Something warm | Quelque chose de chaud | |
| sufraWarmCopy | Stews from the highlands | Les ragoûts des hauts plateaux | |
| sufraRice | Rice and meat | Riz et viande | |
| sufraRiceCopy | Mandi and haneeth | Mandi et haneeth | |
| sufraSides | Small plates | Petites assiettes | |
| sufraSidesCopy | Bread, sahawiq, hummus | Pain, sahawiq, houmous | |
| sufraStatusInitial | Choose one to jump to that part of the menu. | Choisissez-en une pour aller à cette partie du menu. | |
| sufraStatusTraditional | Showing stews and traditional dishes. | Ragoûts et plats traditionnels affichés. | |
| sufraStatusRice | Showing rice and meat dishes. | Plats de riz et de viande affichés. | |
| sufraStatusSides | Showing small plates and sides. | Petites assiettes et accompagnements affichés. | |
| searchLabel | Search the menu | Chercher dans le menu | |
| searchPlaceholder | Dish or ingredient | Plat ou ingrédient | shorter fits 390px |
| catAll | All | Tout | |
| catRice | Rice & meat | Riz et viande | |
| catTraditional | Stews | Ragoûts | clearer than "Traditional" (everything is traditional) |
| catSides | Small plates | Petites assiettes | match the guide |
| catDrinks | Drinks | Boissons | |
| story_1…story_9 | see `docs/dish-stories.md` | voir `docs/dish-stories.md` | one muted line under each description |

### Dish descriptions (`products` / `productTranslations`), revised for length and specificity
| id | EN | FR |
|---|---|---|
| 1 | Lamb and rice cooked together until the meat is tender and the rice holds its flavour. | Agneau et riz cuits ensemble jusqu’à ce que la viande soit fondante et le riz bien parfumé. |
| 2 | Spiced chicken over mandi rice, roasted until golden. | Poulet épicé sur riz mandi, rôti jusqu’à être doré. |
| 3 | Lamb slow-roasted on the bone, simply seasoned. | Agneau rôti lentement sur l’os, simplement assaisonné. |
| 4 | Shredded meat stew served bubbling, with bread for scooping. | Ragoût de viande effilochée servi bouillant, avec du pain pour saucer. |
| 5 | A hot stew finished with whipped fenugreek, eaten with bread. | Un ragoût chaud nappé de fenugrec fouetté, à manger avec du pain. |
| 6 | Warm bread with fresh chilli, tomato and garlic relish. | Pain chaud et sauce fraîche au piment, tomate et ail. |
| 7 | Smooth chickpea purée with olive oil. | Purée de pois chiches onctueuse à l’huile d’olive. |
| 8 | Black tea brewed with milk and warm spices. | Thé noir infusé au lait et aux épices douces. |
| 9 | Ripe mango, pressed and served cold. | Mangue mûre pressée, servie bien froide. |
Ingredients above are generic for the dish; any allergen statement waits for the kitchen (launch-gates A).

---

## Story (`story.html`) — a real narrative, no invented biography

| Key | EN | FR |
|---|---|---|
| storyPageKicker | OUR STORY | NOTRE HISTOIRE |
| storyPageTitle | A Yemeni table, far from Yemen. | Une table yéménite, loin du Yémen. |
| storyPageIntro | AZAL is a Yemeni restaurant for people who miss this food, and for people about to taste it for the first time. | AZAL est un restaurant yéménite pour ceux à qui cette cuisine manque, et pour ceux qui vont la découvrir. |
| **storyP1Title** (new) | Where the food comes from | D’où vient cette cuisine |
| **storyP1** (new) | Yemen’s cooking changes with its land: rice and slow-roasted meat in Hadramaut, stone-pot stews in the highlands around Sana’a, spiced tea in the port of Aden, fruit from the Red Sea plain. Our menu follows that map. | La cuisine du Yémen change avec ses paysages : riz et viandes rôties lentement dans l’Hadramaout, ragoûts en marmite de pierre sur les hauts plateaux autour de Sanaa, thé épicé dans le port d’Aden, fruits de la plaine de la mer Rouge. Notre menu suit cette carte. |
| **storyP2Title** (new) | Why “AZAL” | Pourquoi « AZAL » |
| **storyP2** (new) | {owner: meaning of the name} — fallback until filled: *(row hidden)* | {propriétaire : sens du nom} — repli : *(ligne masquée)* |
| storyValuesKicker | HOW WE COOK | NOTRE FAÇON DE CUISINER |
| storyValuesTitle | Slowly, and for sharing. | Lentement, et pour partager. |
| storyValuesText | Most of these dishes cannot be rushed. We cook them the long way, serve them on plates meant for the middle of the table, and keep the room calm enough to talk. | La plupart de ces plats ne se pressent pas. Nous les cuisinons longuement, les servons sur des plats faits pour le centre de la table, et gardons la salle assez calme pour parler. |
| **storyP3Title** (new) | From {owner: home region/city} to {owner: city} | De {propriétaire : région ou ville d’origine} à {propriétaire : ville} |
| **storyP3** (new) | {owner: 2–3 sentences in their own words: who started AZAL and why}. Fallback until filled: *(section hidden)* | {propriétaire : 2–3 phrases avec ses propres mots}. Repli : *(section masquée)* |
| majlisKicker | THE MAJLIS | LE MAJLIS |
| majlisTitle | A place kept for you. | Une place gardée pour vous. |
| majlisText | In a Yemeni home, the majlis is the room where guests are welcomed. Majlis AZAL will be our membership for regulars: points on your orders, and a few things kept for our first members. It opens soon. | Dans une maison yéménite, le majlis est la pièce où l’on reçoit les invités. Majlis AZAL sera notre programme pour les habitués : des points sur vos commandes, et quelques attentions pour nos premiers membres. Ouverture prochaine. |
| heroMenu (button reused) | See the menu | Voir le menu |

Muse's brief mentioned "Yemen → Ottawa". The repo has no confirmed city (Ottawa/Gatineau appear only as test fixtures), so the city stays a placeholder.

---

## Member (`member.html`) — warm, concrete, no point numbers before P4

| Key | EN | FR | Note |
|---|---|---|---|
| memberKicker | MAJLIS AZAL | MAJLIS AZAL | |
| memberTitle | Be one of our regulars. | Devenez un habitué. | |
| memberIntro | Majlis AZAL is free. Join with your email, earn points every time you pick up an order, and use them on a later meal. | Majlis AZAL est gratuit. Inscrivez-vous avec votre courriel, gagnez des points à chaque commande à emporter et utilisez-les sur un prochain repas. | qualitative, as ordered |
| **memberFounding** (new) | Our first 100 members will be marked as founding members, for good, and earn a little more on every order. | Nos 100 premiers membres porteront pour toujours le titre de membre fondateur et gagneront un peu plus à chaque commande. | Muse ruling: founding-100 yes; no number on the bonus until P4 |
| **memberHow1** (new) | Join once with your email. | Inscrivez-vous une fois avec votre courriel. | three-step list |
| **memberHow2** (new) | Order for pickup; points arrive when you collect. | Commandez à emporter ; les points arrivent au retrait. | |
| **memberHow3** (new) | Use points on a later order. They do not expire. | Utilisez vos points sur une prochaine commande. Ils n’expirent pas. | Muse ruling: no expiry |
| memberDemo | OPENING SOON | OUVERTURE PROCHAINE | replaces "ACCOUNT PREVIEW · NOT ACTIVE" |
| memberCardKicker | YOUR MAJLIS | VOTRE MAJLIS | |
| memberStatusLabel | Membership | Adhésion | |
| memberStatusValue | Opens soon | Bientôt ouvert | |
| memberPointsLabel | Points | Points | |
| memberPointsValue | — | — | a dash reads calmer than "Not active" twice |
| memberNotice | Sign-up is not open yet. Nothing on this page creates an account or asks for your details. | Les inscriptions ne sont pas encore ouvertes. Rien sur cette page ne crée de compte ni ne demande vos coordonnées. | |
| memberSignIn | Sign in | Se connecter | |
| memberJoin | Join Majlis | Rejoindre le Majlis | |
| memberDisabled | Opens soon | Bientôt ouvert | |

---

## Reserve page (new, for R1; strings ready, page not built)

| Key | EN | FR |
|---|---|---|
| reserveTitle | Book a table | Réserver une table |
| reserveIntro | Tables for up to 10 people. For larger groups, write to us. | Tables jusqu’à 10 personnes. Pour les groupes plus nombreux, écrivez-nous. |
| reserveParty | Guests | Personnes |
| reserveDate | Date | Date |
| reserveTime | Time | Heure |
| reserveName | Name | Nom |
| reserveEmail | Email | Courriel |
| reservePhone | Phone (optional) | Téléphone (facultatif) |
| reserveNote | Anything we should know? (optional) | Quelque chose à nous signaler ? (facultatif) |
| reserveSubmit | Book | Réserver |
| reserveFull | That time is full. These are free: | Cet horaire est complet. Ces créneaux sont libres : |
| reserveDone | Your table is booked. We have sent the details to {email}. | Votre table est réservée. Les détails ont été envoyés à {email}. |
| reserveConsent | We use your details only for this booking. | Vos coordonnées servent uniquement à cette réservation. |
Email templates: `docs/reservations-spec.md`.

---

## Pending owner (Tier C; the copy above has a placeholder or hides the row until each exists)
1. City and address, phone. 2. Days open (hours 11–21 given). 3. Meaning of the name "AZAL", in the owner's words. 4. Who started AZAL and why (2–3 sentences, owner's own words; I will edit for length and translate, not invent). 5. Whether "fifty seats" may be shown publicly. 6. Kitchen confirmation of dish descriptions and allergens.

## Integration checklist for ChatGPT
- Replace values key by key; add new keys in both `en` and `fr`; delete `visitTitle2`, `you`, `sufraDemo`.
- Hide any element whose key resolves to a `{owner: …}` placeholder (simple rule: if the string starts with `{owner`, `hidden = true`).
- Extend `tests/smoke.test.mjs`: every `data-i18n` key exists in both languages and no rendered string contains `{owner` or `{` placeholders outside the reserve/email templates.
- Keep the preview strings until Muse records the go-live; the launch column is the swap list.
