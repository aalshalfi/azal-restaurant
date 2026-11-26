const translations = {
 en: {
  authClaimed:"We added {points} points from your earlier orders.",
  authClaimFailed:"We couldn’t collect points from your earlier orders just now. They are kept for you.",
  authClaimRetry:"Try again",
  authErrInvalidEmail:"Please check your email address.",
  authErrMissingEmail:"Enter your email.",
  authErrCode:"That code didn’t work or has expired. Try again or send a new one.",
  authUseCode:"Use an email code instead",
  authUsePassword:"Use a password instead",
  authCodeNote:"No password needed. New here? The same code creates your Majlis account.",
  authCodeChange:"Use another email",
  authCodeWait:"Please wait a minute before asking for another code.",
  authCodeResent:"A new code is on its way.",
  authCodeResend:"Send a new code",
  authCodeVerify:"Continue",
  authCodeLabel:"Code from the email",
  authCodeSent:"We emailed {email}. Enter the code below, or tap the link in the email. It works for a few minutes.",
  authLinkInvalid:"That sign-in link has expired or was already used. Ask for a new one below.",
  authCodeSend:"Email me a code",
  authCodeTitle:"Sign in or join with your email.",
  authErrGeneric:"Something went wrong. Please try again.",
  authErrNetwork:"No connection. Check your network and try again.",
  authErrRate:"Too many tries. Wait a minute and try again.",
  authErrWeak:"Choose a longer password (8 characters or more).",
  authErrClosed:"Joining isn’t open yet.",
  authErrExists:"This email already has an account. Sign in instead.",
  authErrConfirm:"Please confirm your email first, then sign in.",
  authErrCredentials:"That email and password don’t match.",
  authErrMissing:"Enter your email and a password.",
  authCheckEmail:"Check your email to confirm your account, then sign in.",
  authSignOut:"Sign out",
  authPreviewNote:"Points from your paid, collected orders appear here.",
  authSettingUp:"Setting up your account…",
  authMemberNone:"Signed in; membership is being activated",
  authMemberActive:"Member",
  authHello:"Welcome, {name}.",
  authPrivacy:"We use your email only for your Majlis account. No payment details are asked for.",
  authHaveAccount:"Already a member? Sign in",
  authNoAccount:"New here? Join Majlis",
  authPassword:"Password (8 characters or more)",
  authEmail:"Email",
  authJoinTitle:"Join Majlis AZAL.",
  authSignInTitle:"Welcome back.",
  navMajlisMine:"My Majlis",
  pickupFreshNote:"Fresh: a batch of mandi and haneeth comes out of the oven at that time. Example times for this preview; our kitchen will set the real ones.",
  pickupFreshLong:"fresh from the oven",
  pickupFreshShort:"Fresh",
  ritualClose:"In Yemen the meal ends when the talk does, not when the plates are empty.",
  ritualJuice:"End with something cold: the mango juice.",
  ritualChai:"Finish with Adeni chai, poured hot, and take your time.",
  ritualBread:"Keep the sahawiq close: a little on the bread with every bite.",
  ritualPlatter:"Put the platter in the middle of the table; everyone eats from the same plate.",
  ritualStew:"Start with the stew while it still bubbles: tear the bread and scoop, no spoon needed.",
  ritualDraft:"Draft serving guide, to be confirmed by our kitchen.",
  ritualTitle:"Eat it the Yemeni way",
  nfText:"The link may be old or mistyped. Everything else is still here.",
  nfTitle:"This page isn’t on the menu.",
  storyMapKicker:"THE MAP",
  title_404:"Page not found · AZAL",
  title_reserve:"Book a table · AZAL",
  title_member:"Majlis · AZAL",
  title_story:"Our story · AZAL",
  title_menu:"Menu · AZAL",
  title_home:"AZAL · Yemeni kitchen",
  reserveMeanwhile:"See the menu meanwhile",
  reserveNotice:"Booking is not open yet. Nothing on this page books a table or collects your details.",
  reserveDeposit:"No deposit to book.",
  reserveHow3:"We confirm by email; the same email lets you cancel.",
  reserveHow2:"Leave a name and an email. Nothing else.",
  reserveHow1:"Choose the day, the time and how many of you are coming.",
  reserveHowTitle:"How booking will work",
  reserveSoon:"OPENING SOON",
  reserveIntro:"Come and sit with us: the majlis way, around shared plates. Online booking opens soon.",
  reserveTitle:"Book a table",
  reserveKicker:"TABLES",
  navReserve:"Reserve",
  pickupSlotsLabel:"Pickup times",
  pickupChosen:"Pickup preview: {time}.",
  pickupBeforeOpen:"We open at {time}.",
  pickupClosedToday:"We’ve closed for orders today. Order now for pickup {day} from {time}.",
  pickupTomorrow:"tomorrow",
  pickupTz:"Times are Toronto time.",
  pickupMore:"Show more times",
  pickupLaterTomorrow:"Choose another time",
  pickupLater:"Later today",
  pickupAsap:"As soon as possible · ready about {time}",
  pickupTitle:"Pickup time",
  sufraSummary:"Not sure where to start? Pick a mood",
  skipLink:"Skip to content",
  ariaHome:"AZAL home",
  ariaCloseCart:"Close cart",
  ariaClose:"Close",
  ariaFilter:"Filter menu by category",
  ariaMainNav:"Main navigation",
  ariaOpenNav:"Open navigation",
  ariaHeroImage:"Traditional Yemeni rice and lamb feast",
  ariaYourOrder:"Your order",
  altLogo:"AZAL Restaurant",
  altLogoFooter:"AZAL \u2014 Yemeni Kitchen",
  altChai:"Illustrative Adeni chai",
  altFahsa:"Illustrative Yemeni Fahsa",
  altMandi:"Illustrative Yemeni rice and lamb dish",
  sayIt:"Say it",
  signatureMore:"See the full menu",
  sfnSummary:"Ordering for a group? Build a spread",
  sfnTitle:"How many at the table?",
  sfnIntro:"In Yemen a meal is set out to share. Pick the number of guests and we suggest a full spread from the menu. Change anything before you add it.",
  sfnGroup:"Number of guests",
  sfnGuests:"guests",
  sfnNote:"A suggestion from the example menu; portions are illustrative.",
  sfnTotal:"Spread total",
  sfnAdd:"Add the spread to my order",
  sfnAdded:"Added the spread for {n}: {count} items.",
  sfnEmpty:"Nothing left in the spread. Pick a table size to start again.",
  navHome:"Home",
  navMenu:"Menu",
  navStory:"Our story",
  navVisit:"Visit",
  navMajlis:"Majlis",
  cartButton:"Your order",
  stickyCartLabel:"View your order",
  signatureKicker:"WHERE TO BEGIN",
  signatureTitle:"Three dishes, three regions.",
  signatureIntro:"A first taste of the menu. Each dish comes from a different corner of Yemen.",
  signatureLabel:"EXAMPLE DISH",
  signatureMandi:"Lamb mandi",
  signatureMandiText:"Hadramaut · lamb and rice cooked together, slow and smoky.",
  signatureFahsa:"Fahsa",
  signatureFahsaText:"Sana’a · a meat stew that arrives sizzling in a stone pot.",
  signatureChai:"Adeni chai",
  signatureChaiText:"Aden · black tea, milk and warm spice.",
  storyTeaserLink:"Read our story",
  menuPageTitle:"The AZAL menu.",
  menuPageIntro:"A sample of Yemeni dishes, made for discovery. All dishes and prices are illustrative only.",
  storyPageKicker:"OUR STORY",
  storyPageTitle:"A Yemeni table, far from Yemen.",
  storyPageIntro:"AZAL is a Yemeni restaurant for people who miss this food, and for people about to taste it for the first time.",
  storyValuesKicker:"HOW WE COOK",
  storyValuesTitle:"Slowly, and for sharing.",
  storyValuesText:"Most of these dishes cannot be rushed. We cook them the long way, serve them on plates meant for the middle of the table, and keep the room calm enough to talk.",
  majlisKicker:"THE MAJLIS",
  majlisTitle:"A place kept for you.",
  majlisText:"In a Yemeni home, the majlis is the room where guests are welcomed. Majlis AZAL will be our membership for regulars: points on your orders, and a few things kept for our first members. It opens soon.",
  memberKicker:"MAJLIS AZAL",
  memberTitle:"Be one of our regulars.",
  memberIntro:"Majlis AZAL is free. Join with your email, earn points every time you pick up an order, and use them on a later meal.",
  memberDemo:"OPENING SOON",
  memberCardKicker:"YOUR MAJLIS",
  memberStatusLabel:"Membership",
  memberStatusValue:"Opens soon",
  memberPointsLabel:"Points",
  memberPointsValue:"—",
  memberNotice:"Sign-up is not open yet. Nothing on this page creates an account or asks for your details.",
  memberSignIn:"Sign in",
  memberJoin:"Join Majlis",
  memberDisabled:"Opens soon",
  heroBottom:"YEMENI ROOTS · CANADIAN FUTURE",
  heroEyebrow:"YEMENI KITCHEN · PICKUP & TABLES",
  heroTitle:"Slow-cooked Yemen,",
  heroTitleEm:"shared at your table.",
  heroText:"Mandi from Hadramaut, saltah from Sana’a, chai from Aden. Order ahead for pickup, or come and sit with us.",
  heroMenu:"See the menu",
  heroStory:"Our story",
  sampleNote:"PREVIEW · DISHES AND PRICES ARE EXAMPLES",
  storyKicker:"THE IDEA",
  storyTitle:"In Yemen, a guest",
  storyTitleEm:"is never served alone.",
  storyText:"Yemeni meals come on large plates in the middle of the table, and everyone reaches in. AZAL is built around that habit: dishes made to be shared, and a room where you can stay a while.",
  menuKicker:"THE MENU",
  menuTitle:"Made to",
  menuTitleEm:"share.",
  menuIntro:"Dishes and prices are examples while we prepare to open. Ordering is not live yet.",
  demoLabel:"EXAMPLE MENU · EXAMPLE PRICES",
  searchLabel:"Search the menu",
  searchPlaceholder:"Dish or ingredient",
  catAll:"All",
  catRice:"Rice & meat",
  catTraditional:"Stews",
  catSides:"Small plates",
  catDrinks:"Drinks",
  sufraKicker:"NOT SURE WHERE TO START?",
  sufraTitle:"Pick a mood,",
  sufraTitleEm:"we’ll point the way.",
  sufraIntro:"Three easy ways into the menu.",
  sufraGroup:"Ways into the menu",
  sufraWarm:"Something warm",
  sufraWarmCopy:"Stews from the highlands",
  sufraRice:"Rice and meat",
  sufraRiceCopy:"Mandi and haneeth",
  sufraSides:"Small plates",
  sufraSidesCopy:"Bread, sahawiq, hummus",
  sufraStatusInitial:"Choose one to jump to that part of the menu.",
  sufraStatusTraditional:"Showing stews and traditional dishes.",
  sufraStatusRice:"Showing rice and meat dishes.",
  sufraStatusSides:"Showing small plates and sides.",
  visitKicker:"VISIT",
  visitTitle:"Come and eat with us.",
  visitText:"We are getting ready to open. The address and phone number will be posted here once confirmed.",
  visitCard:"AZAL",
  visitCardTitle:"One room,",
  visitCardTitle2:"one warm welcome.",
  locationLabel:"Where",
  toAnnounce:"Address coming soon",
  addressLabel:"Phone",
  comingSoon:"Coming soon",
  hoursLabel:"Hours",
  footerTagline:"Yemeni food, made to share.",
  footerLegal:"AZAL · Yemeni restaurant · Preview site",
  photoCreditsLabel:"Photos are illustrative, not AZAL’s own. Credits:",
  cartKicker:"YOUR ORDER",
  cartTitle:"For pickup",
  subtotal:"Subtotal",
  cartDisclaimer:"Preview only: nothing is sent or charged.",
  checkoutButton:"Continue",
  demoOnly:"PREVIEW",
  checkoutTitle:"Almost there.",
  checkoutText:"This preview does not send your order to the kitchen or take payment.",
  demoPickupOnly:"Nothing you choose here is sent, stored or charged.",
  placeDemo:"See the preview",
  add:"Add",
  added:"Added",
  noResults:"No dish matches that. Try another word or show all dishes.",
  emptyCart:"Nothing here yet. The menu is a good place to start.",
  each:"each",
  removeOne:"Remove one",
  addOne:"Add one",
  thankYou:"Preview",
  demoContains:"Your order would include",
  items:"item(s)",
  notSent:"Nothing was sent to the restaurant.",
  cartLive:"Added to your order: {dish}.",
  cartLiveRemoved:"Removed from your order: {dish}.",
  menuH1:"AZAL menu",
  storyP1Title:"Where the food comes from",
  storyP1:"Yemen’s cooking changes with its land: rice and slow-roasted meat in Hadramaut, stone-pot stews in the highlands around Sana’a, spiced tea in the port of Aden, fruit from the Red Sea plain. Our menu follows that map.",
  memberFounding:"Our first 100 members will be marked as founding members.",
  memberHow1:"Join once with your email.",
  memberHow2:"Order for pickup; points are added once your order is paid and collected.",
  memberHow3:"Use your points on a later order."
 },
 fr: {
  authClaimed:"Nous avons ajouté {points} points de vos commandes précédentes.",
  authClaimFailed:"Nous n’avons pas pu récupérer les points de vos commandes précédentes pour l’instant. Ils vous sont gardés.",
  authClaimRetry:"Réessayer",
  authErrInvalidEmail:"Veuillez vérifier votre adresse courriel.",
  authErrMissingEmail:"Entrez votre courriel.",
  authErrCode:"Ce code ne fonctionne pas ou a expiré. Réessayez ou demandez-en un nouveau.",
  authUseCode:"Utiliser un code par courriel",
  authUsePassword:"Utiliser un mot de passe",
  authCodeNote:"Aucun mot de passe. Nouveau ? Le même code crée votre compte Majlis.",
  authCodeChange:"Utiliser un autre courriel",
  authCodeWait:"Attendez une minute avant de demander un autre code.",
  authCodeResent:"Un nouveau code est en route.",
  authCodeResend:"Envoyer un nouveau code",
  authCodeVerify:"Continuer",
  authCodeLabel:"Code reçu par courriel",
  authCodeSent:"Nous avons écrit à {email}. Saisissez le code ci-dessous ou touchez le lien dans le courriel. Il est valable quelques minutes.",
  authLinkInvalid:"Ce lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau ci-dessous.",
  authCodeSend:"Recevoir un code",
  authCodeTitle:"Connectez-vous ou rejoignez-nous avec votre courriel.",
  authErrGeneric:"Un problème est survenu. Veuillez réessayer.",
  authErrNetwork:"Pas de connexion. Vérifiez votre réseau et réessayez.",
  authErrRate:"Trop d’essais. Attendez une minute et réessayez.",
  authErrWeak:"Choisissez un mot de passe plus long (8 caractères ou plus).",
  authErrClosed:"Les inscriptions ne sont pas encore ouvertes.",
  authErrExists:"Ce courriel a déjà un compte. Connectez-vous plutôt.",
  authErrConfirm:"Confirmez d’abord votre courriel, puis connectez-vous.",
  authErrCredentials:"Ce courriel et ce mot de passe ne correspondent pas.",
  authErrMissing:"Entrez votre courriel et un mot de passe.",
  authCheckEmail:"Vérifiez votre courriel pour confirmer votre compte, puis connectez-vous.",
  authSignOut:"Se déconnecter",
  authPreviewNote:"Les points de vos commandes payées et retirées apparaissent ici.",
  authSettingUp:"Préparation de votre compte…",
  authMemberNone:"Connecté ; adhésion en cours d’activation",
  authMemberActive:"Membre",
  authHello:"Bienvenue, {name}.",
  authPrivacy:"Votre courriel sert uniquement à votre compte Majlis. Aucune donnée de paiement n’est demandée.",
  authHaveAccount:"Déjà membre ? Se connecter",
  authNoAccount:"Nouveau ? Rejoindre le Majlis",
  authPassword:"Mot de passe (8 caractères ou plus)",
  authEmail:"Courriel",
  authJoinTitle:"Rejoignez le Majlis AZAL.",
  authSignInTitle:"Bon retour.",
  navMajlisMine:"Mon Majlis",
  pickupFreshNote:"Du four : une fournée de mandi et de haneeth sort du four à cette heure-là. Heures d’exemple pour cet aperçu ; notre cuisine fixera les vraies.",
  pickupFreshLong:"tout juste sorti du four",
  pickupFreshShort:"Du four",
  ritualClose:"Au Yémen, le repas finit quand la conversation s’arrête, pas quand les plats sont vides.",
  ritualJuice:"Finissez sur une note fraîche : le jus de mangue.",
  ritualChai:"Terminez par le thé adéni, servi bien chaud, sans vous presser.",
  ritualBread:"Gardez le sahawiq à portée : un peu sur le pain à chaque bouchée.",
  ritualPlatter:"Posez le plat au centre de la table ; chacun se sert dans le même plat.",
  ritualStew:"Commencez par le ragoût encore bouillant : déchirez le pain et saucez, sans cuillère.",
  ritualDraft:"Guide de service provisoire, à confirmer par notre cuisine.",
  ritualTitle:"À la yéménite",
  nfText:"Le lien est peut-être ancien ou mal saisi. Tout le reste est toujours là.",
  nfTitle:"Cette page n’est pas au menu.",
  storyMapKicker:"LA CARTE",
  title_404:"Page introuvable · AZAL",
  title_reserve:"Réserver · AZAL",
  title_member:"Majlis · AZAL",
  title_story:"Notre histoire · AZAL",
  title_menu:"Menu · AZAL",
  title_home:"AZAL · Cuisine yéménite",
  reserveMeanwhile:"Voir le menu en attendant",
  reserveNotice:"Les réservations ne sont pas encore ouvertes. Rien sur cette page ne réserve une table ni ne recueille vos coordonnées.",
  reserveDeposit:"Aucun dépôt pour réserver.",
  reserveHow3:"Nous confirmons par courriel ; ce même courriel permet d’annuler.",
  reserveHow2:"Laissez un nom et un courriel. Rien d’autre.",
  reserveHow1:"Choisissez le jour, l’heure et le nombre de personnes.",
  reserveHowTitle:"Comment réserver",
  reserveSoon:"OUVERTURE PROCHAINE",
  reserveIntro:"Venez vous asseoir avec nous, à la manière du majlis, autour de plats partagés. La réservation en ligne ouvre bientôt.",
  reserveTitle:"Réserver une table",
  reserveKicker:"RÉSERVATIONS",
  navReserve:"Réserver",
  pickupSlotsLabel:"Horaires de retrait",
  pickupChosen:"Retrait (aperçu) : {time}.",
  pickupBeforeOpen:"Nous ouvrons à {time}.",
  pickupClosedToday:"Les commandes sont fermées pour aujourd’hui. Commandez maintenant pour un retrait {day} dès {time}.",
  pickupTomorrow:"demain",
  pickupTz:"Heures de Toronto.",
  pickupMore:"Plus d’horaires",
  pickupLaterTomorrow:"Choisir une autre heure",
  pickupLater:"Plus tard aujourd’hui",
  pickupAsap:"Dès que possible · prêt vers {time}",
  pickupTitle:"Heure de retrait",
  sufraSummary:"Vous hésitez ? Choisissez une envie",
  skipLink:"Aller au contenu",
  ariaHome:"Accueil AZAL",
  ariaCloseCart:"Fermer la commande",
  ariaClose:"Fermer",
  ariaFilter:"Filtrer le menu par catégorie",
  ariaMainNav:"Navigation principale",
  ariaOpenNav:"Ouvrir le menu",
  ariaHeroImage:"Festin yéménite traditionnel de riz et d’agneau",
  ariaYourOrder:"Votre commande",
  altLogo:"Restaurant AZAL",
  altLogoFooter:"AZAL — Cuisine yéménite",
  altChai:"Thé adéni (photo d’illustration)",
  altFahsa:"Fahsa yéménite (photo d’illustration)",
  altMandi:"Riz et agneau yéménites (photo d’illustration)",
  sayIt:"Prononcez",
  signatureMore:"Voir tout le menu",
  sfnSummary:"Vous commandez pour un groupe ? Composez une sufra",
  sfnTitle:"Combien êtes-vous à table ?",
  sfnIntro:"Au Yémen, le repas se partage. Choisissez le nombre de convives et nous proposons une table complète tirée du menu. Modifiez ce que vous voulez avant de l’ajouter.",
  sfnGroup:"Nombre de convives",
  sfnGuests:"personnes",
  sfnNote:"Une suggestion tirée du menu d’exemple ; les portions sont indicatives.",
  sfnTotal:"Total de la sufra",
  sfnAdd:"Ajouter la sufra à ma commande",
  sfnAdded:"Sufra pour {n} ajoutée : {count} articles.",
  sfnEmpty:"Il ne reste rien dans la sufra. Choisissez un nombre de convives pour recommencer.",
  navHome:"Accueil",
  navMenu:"Menu",
  navStory:"Notre histoire",
  navVisit:"Nous trouver",
  navMajlis:"Majlis",
  cartButton:"Votre commande",
  stickyCartLabel:"Voir la commande",
  signatureKicker:"PAR OÙ COMMENCER",
  signatureTitle:"Trois plats, trois régions.",
  signatureIntro:"Un premier aperçu du menu. Chaque plat vient d’une région différente du Yémen.",
  signatureLabel:"PLAT D’EXEMPLE",
  signatureMandi:"Mandi d’agneau",
  signatureMandiText:"Hadramaout · agneau et riz cuits ensemble, lentement, au goût fumé.",
  signatureFahsa:"Fahsa",
  signatureFahsaText:"Sanaa · un ragoût de viande servi bouillant dans une marmite en pierre.",
  signatureChai:"Thé adéni",
  signatureChaiText:"Aden · thé noir, lait et épices douces.",
  storyTeaserLink:"Lire notre histoire",
  menuPageTitle:"Le menu AZAL.",
  menuPageIntro:"Un aperçu de plats yéménites. Tous les plats et prix sont donnés à titre illustratif.",
  storyPageKicker:"NOTRE HISTOIRE",
  storyPageTitle:"Une table yéménite, loin du Yémen.",
  storyPageIntro:"AZAL est un restaurant yéménite pour ceux à qui cette cuisine manque, et pour ceux qui vont la découvrir.",
  storyValuesKicker:"NOTRE FAÇON DE CUISINER",
  storyValuesTitle:"Lentement, et pour partager.",
  storyValuesText:"La plupart de ces plats ne se pressent pas. Nous les cuisinons longuement, les servons sur des plats faits pour le centre de la table, et gardons la salle assez calme pour parler.",
  majlisKicker:"LE MAJLIS",
  majlisTitle:"Une place gardée pour vous.",
  majlisText:"Dans une maison yéménite, le majlis est la pièce où l’on reçoit les invités. Majlis AZAL sera notre programme pour les habitués : des points sur vos commandes, et quelques attentions pour nos premiers membres. Ouverture prochaine.",
  memberKicker:"MAJLIS AZAL",
  memberTitle:"Devenez un habitué.",
  memberIntro:"Majlis AZAL est gratuit. Inscrivez-vous avec votre courriel, gagnez des points à chaque commande à emporter et utilisez-les sur un prochain repas.",
  memberDemo:"OUVERTURE PROCHAINE",
  memberCardKicker:"VOTRE MAJLIS",
  memberStatusLabel:"Adhésion",
  memberStatusValue:"Bientôt ouvert",
  memberPointsLabel:"Points",
  memberPointsValue:"—",
  memberNotice:"Les inscriptions ne sont pas encore ouvertes. Rien sur cette page ne crée de compte ni ne demande vos coordonnées.",
  memberSignIn:"Se connecter",
  memberJoin:"Rejoindre le Majlis",
  memberDisabled:"Bientôt ouvert",
  heroBottom:"RACINES YÉMÉNITES · AVENIR CANADIEN",
  heroEyebrow:"CUISINE YÉMÉNITE · À EMPORTER ET SUR PLACE",
  heroTitle:"Le Yémen, mijoté lentement,",
  heroTitleEm:"partagé à votre table.",
  heroText:"Le mandi de l’Hadramaout, la saltah de Sanaa, le thé d’Aden. Commandez à l’avance ou venez vous asseoir avec nous.",
  heroMenu:"Voir le menu",
  heroStory:"Notre histoire",
  sampleNote:"APERÇU · PLATS ET PRIX DONNÉS À TITRE D’EXEMPLE",
  storyKicker:"L’IDÉE",
  storyTitle:"Au Yémen, un invité",
  storyTitleEm:"n’est jamais servi seul.",
  storyText:"Au Yémen, les plats arrivent au centre de la table et chacun se sert. AZAL est né de cette habitude : des plats faits pour être partagés, et un lieu où l’on prend son temps.",
  menuKicker:"LE MENU",
  menuTitle:"Fait pour",
  menuTitleEm:"être partagé.",
  menuIntro:"Les plats et les prix sont des exemples en attendant l’ouverture. La commande n’est pas encore active.",
  demoLabel:"MENU D’EXEMPLE · PRIX D’EXEMPLE",
  searchLabel:"Chercher dans le menu",
  searchPlaceholder:"Plat ou ingrédient",
  catAll:"Tout",
  catRice:"Riz et viande",
  catTraditional:"Ragoûts",
  catSides:"Petites assiettes",
  catDrinks:"Boissons",
  sufraKicker:"VOUS HÉSITEZ ?",
  sufraTitle:"Choisissez une envie,",
  sufraTitleEm:"on vous guide.",
  sufraIntro:"Trois façons simples d’entrer dans le menu.",
  sufraGroup:"Façons d’entrer dans le menu",
  sufraWarm:"Quelque chose de chaud",
  sufraWarmCopy:"Les ragoûts des hauts plateaux",
  sufraRice:"Riz et viande",
  sufraRiceCopy:"Mandi et haneeth",
  sufraSides:"Petites assiettes",
  sufraSidesCopy:"Pain, sahawiq, houmous",
  sufraStatusInitial:"Choisissez-en une pour aller à cette partie du menu.",
  sufraStatusTraditional:"Ragoûts et plats traditionnels affichés.",
  sufraStatusRice:"Plats de riz et de viande affichés.",
  sufraStatusSides:"Petites assiettes et accompagnements affichés.",
  visitKicker:"NOUS RENDRE VISITE",
  visitTitle:"Venez manger avec nous.",
  visitText:"Nous préparons l’ouverture. L’adresse et le téléphone seront publiés ici dès qu’ils seront confirmés.",
  visitCard:"AZAL",
  visitCardTitle:"Une salle,",
  visitCardTitle2:"un accueil chaleureux.",
  locationLabel:"Où",
  toAnnounce:"Adresse à venir",
  addressLabel:"Téléphone",
  comingSoon:"À venir",
  hoursLabel:"Heures",
  footerTagline:"La cuisine yéménite, faite pour être partagée.",
  footerLegal:"AZAL · Restaurant yéménite · Site en aperçu",
  photoCreditsLabel:"Photos d’illustration, ne provenant pas d’AZAL. Crédits :",
  cartKicker:"VOTRE COMMANDE",
  cartTitle:"À emporter",
  subtotal:"Sous-total",
  cartDisclaimer:"Aperçu seulement : rien n’est envoyé ni facturé.",
  checkoutButton:"Continuer",
  demoOnly:"APERÇU",
  checkoutTitle:"Presque prêt.",
  checkoutText:"Cet aperçu n’envoie pas votre commande en cuisine et ne prélève aucun paiement.",
  demoPickupOnly:"Rien de ce que vous choisissez ici n’est envoyé, enregistré ni facturé.",
  placeDemo:"Voir l’aperçu",
  add:"Ajouter",
  added:"Ajouté",
  noResults:"Aucun plat ne correspond. Essayez un autre mot ou affichez tous les plats.",
  emptyCart:"Rien pour l’instant. Le menu est un bon point de départ.",
  each:"chacun",
  removeOne:"En retirer un",
  addOne:"En ajouter un",
  thankYou:"Aperçu",
  demoContains:"Votre commande comprendrait",
  items:"article(s)",
  notSent:"Rien n’a été envoyé au restaurant.",
  cartLive:"Ajouté à votre commande : {dish}.",
  cartLiveRemoved:"Retiré de votre commande : {dish}.",
  menuH1:"Menu AZAL",
  storyP1Title:"D’où vient cette cuisine",
  storyP1:"La cuisine du Yémen change avec ses paysages : riz et viandes rôties lentement dans l’Hadramaout, ragoûts en marmite de pierre sur les hauts plateaux autour de Sanaa, thé épicé dans le port d’Aden, fruits de la plaine de la mer Rouge. Notre menu suit cette carte.",
  memberFounding:"Nos 100 premiers membres porteront le titre de membre fondateur.",
  memberHow1:"Inscrivez-vous une fois avec votre courriel.",
  memberHow2:"Commandez à emporter ; les points sont ajoutés une fois la commande payée et retirée.",
  memberHow3:"Utilisez vos points sur une prochaine commande."
 }
,
 ar:{authClaimed:"أضفنا {points} إلى رصيد نقاطك من طلباتك السابقة.",authClaimFailed:"لم نتمكن من إضافة نقاط طلباتك السابقة الآن. هي محفوظة لك.",authClaimRetry:"حاول مرة أخرى",authErrInvalidEmail:"تحقّق من بريدك الإلكتروني.",authErrMissingEmail:"اكتب بريدك الإلكتروني.",authErrCode:"الرمز غير صحيح أو انتهت صلاحيته. حاول مرة أخرى أو اطلب رمزاً جديداً.",authUseCode:"استخدم رمزاً يصلك بالبريد بدلاً من ذلك",authUsePassword:"استخدم كلمة مرور بدلاً من ذلك",authCodeNote:"لا حاجة لكلمة مرور. جديد هنا؟ الرمز نفسه ينشئ حسابك في المجلس.",authCodeChange:"استخدم بريداً آخر",authCodeWait:"انتظر دقيقة قبل طلب رمز جديد.",authCodeResent:"رمز جديد في الطريق إليك.",authCodeResend:"أرسل رمزاً جديداً",authCodeVerify:"متابعة",authCodeLabel:"الرمز الذي وصلك بالبريد",authCodeSent:"راسلنا {email}. اكتب الرمز أدناه، أو اضغط الرابط في البريد. صالح لبضع دقائق.",authLinkInvalid:"انتهت صلاحية رابط الدخول أو استُخدم من قبل. اطلب رابطاً جديداً أدناه.",authCodeSend:"أرسل لي رمزاً بالبريد",authCodeTitle:"ادخل أو انضم ببريدك الإلكتروني.",authErrGeneric:"حدث خطأ. حاول مرة أخرى.",authErrNetwork:"لا يوجد اتصال. تحقّق من الشبكة وحاول مرة أخرى.",authErrRate:"محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.",authErrWeak:"اختر كلمة مرور أطول (8 أحرف أو أكثر).",authErrClosed:"الانضمام غير متاح بعد.",authErrExists:"هذا البريد لديه حساب بالفعل. سجّل الدخول.",authErrConfirm:"أكّد بريدك الإلكتروني أولاً، ثم سجّل الدخول.",authErrCredentials:"البريد وكلمة المرور غير متطابقين.",authErrMissing:"اكتب بريدك الإلكتروني وكلمة مرور.",authCheckEmail:"افتح بريدك لتأكيد حسابك، ثم سجّل الدخول.",authSignOut:"تسجيل الخروج",authPreviewNote:"تظهر هنا نقاط طلباتك المدفوعة التي استلمتها.",authSettingUp:"نجهّز حسابك…",authMemberNone:"تم تسجيل الدخول، ويجري تفعيل عضويتك.",authMemberActive:"عضو",authHello:"أهلاً، {name}.",authPrivacy:"نستخدم بريدك لحسابك في المجلس فقط. لا نطلب أي بيانات دفع.",authHaveAccount:"عضو بالفعل؟ سجّل الدخول",authNoAccount:"جديد هنا؟ انضم إلى المجلس",authPassword:"كلمة المرور (8 أحرف أو أكثر)",authEmail:"البريد الإلكتروني",authJoinTitle:"انضم إلى مجلس أزال.",authSignInTitle:"أهلاً بعودتك.",navMajlisMine:"مجلسي",pickupFreshNote:"طازج: دفعة من المندي والحنيذ تخرج من الفرن في هذا الوقت. أوقات للتوضيح في هذه المعاينة؛ مطبخنا سيحدد الأوقات الفعلية.",pickupFreshLong:"خارج من الفرن للتو",pickupFreshShort:"طازج",ritualClose:"في اليمن تنتهي الوجبة حين ينتهي الحديث، لا حين تفرغ الصحون.",ritualJuice:"اختم بشيء بارد: عصير المانجو.",ritualChai:"اختم بالشاي العدني، يُصبّ ساخناً، وخذ وقتك.",ritualBread:"أبقِ السحاوق قريباً: قليل منه على الخبز مع كل لقمة.",ritualPlatter:"ضع الصحن في وسط السفرة؛ الجميع يأكلون من صحن واحد.",ritualStew:"ابدأ بالمرق وهو يغلي: قطّع الخبز وغمّسه، لا حاجة للملعقة.",ritualDraft:"دليل تقديم مبدئي، يؤكده مطبخنا لاحقاً.",ritualTitle:"كُلها على الطريقة اليمنية",nfText:"ربما الرابط قديم أو فيه خطأ. كل شيء آخر ما زال هنا.",nfTitle:"هذه الصفحة ليست في القائمة.",storyMapKicker:"الخريطة",title_404:"الصفحة غير موجودة · أزال",title_reserve:"احجز طاولة · أزال",title_member:"المجلس · أزال",title_story:"قصتنا · أزال",title_menu:"القائمة · أزال",title_home:"أزال · مطبخ يمني",reserveMeanwhile:"تصفّح القائمة في الأثناء",reserveNotice:"الحجز غير متاح بعد. لا شيء في هذه الصفحة يحجز طاولة أو يجمع بياناتك.",reserveDeposit:"لا عربون للحجز.",reserveHow3:"نؤكد الحجز بالبريد؛ والبريد نفسه يتيح لك الإلغاء.",reserveHow2:"اترك اسمك ورقم جوالك وبريدك. لا شيء غير ذلك.",reserveHow1:"اختر اليوم والوقت وعدد الأشخاص.",reserveHowTitle:"كيف سيعمل الحجز",reserveSoon:"قريباً",reserveIntro:"تعال واجلس معنا: على طريقة المجلس، حول صحون مشتركة. الحجز عبر الموقع قريباً.",reserveTitle:"احجز طاولة",reserveKicker:"الطاولات",navReserve:"احجز",pickupSlotsLabel:"أوقات الاستلام",pickupChosen:"معاينة الاستلام: {time}.",pickupBeforeOpen:"نفتح الساعة {time}.",pickupClosedToday:"أغلقنا الطلبات لليوم. اطلب الآن للاستلام {day} ابتداءً من {time}.",pickupTomorrow:"غداً",pickupTz:"الأوقات بتوقيت تورنتو.",pickupMore:"أوقات أخرى",pickupLaterTomorrow:"اختر وقتاً آخر",pickupLater:"لاحقاً اليوم",pickupAsap:"في أقرب وقت · جاهز تقريباً {time}",pickupTitle:"وقت الاستلام",sufraSummary:"لا تعرف من أين تبدأ؟ اختر مزاجك",skipLink:"انتقل إلى المحتوى",ariaHome:"الصفحة الرئيسية لأزال",ariaCloseCart:"إغلاق السلة",ariaClose:"إغلاق",ariaFilter:"تصفية القائمة حسب الصنف",ariaMainNav:"التنقل الرئيسي",ariaOpenNav:"فتح القائمة",ariaHeroImage:"وليمة يمنية تقليدية من الأرز ولحم الضأن",ariaYourOrder:"طلبك",altLogo:"مطعم أزال",altLogoFooter:"أزال — مطبخ يمني",altChai:"صورة توضيحية للشاي العدني",altFahsa:"صورة توضيحية للفحسة اليمنية",altMandi:"صورة توضيحية لطبق يمني من الأرز ولحم الضأن",sayIt:"انطقها",signatureMore:"شاهد القائمة كاملة",sfnSummary:"تطلب لمجموعة؟ جهّز سفرة",sfnTitle:"كم شخصاً على السفرة؟",sfnIntro:"في اليمن تُفرش الوجبة ليتشاركها الجميع. اختر عدد الضيوف ونقترح لك سفرة كاملة من القائمة. غيّر ما تشاء قبل الإضافة.",sfnGroup:"عدد الضيوف",sfnGuests:"ضيوف",sfnNote:"اقتراح من قائمة العرض؛ الكميات توضيحية.",sfnTotal:"مجموع السفرة",sfnAdd:"أضف السفرة إلى طلبي",sfnAdded:"أضفنا سفرة {n}: {count} صنف.",sfnEmpty:"لم يبقَ شيء في السفرة. اختر عدد الأشخاص للبدء من جديد.",navHome:"الرئيسية",navMenu:"القائمة",navStory:"قصتنا",navVisit:"زُرنا",navMajlis:"المجلس",cartButton:"طلبك",stickyCartLabel:"اعرض طلبك",signatureKicker:"من أين تبدأ",signatureTitle:"ثلاثة أطباق، ثلاث مناطق.",signatureIntro:"لمحة أولى من القائمة. كل طبق من ركن مختلف من اليمن.",signatureLabel:"طبق للعرض",signatureMandi:"مندي لحم",signatureMandiText:"حضرموت · يُطهى اللحم والأرز معًا، على مهل وبنكهة الدخان.",signatureFahsa:"فحسة",signatureFahsaText:"صنعاء · مرق لحم يصل يغلي في المقلى الحجري.",signatureChai:"شاي عدني",signatureChaiText:"عدن · شاي أسود وحليب وبهارات دافئة.",storyTeaserLink:"اقرأ قصتنا",menuPageTitle:"قائمة أزال.",menuPageIntro:"عينة من الأطباق اليمنية للاكتشاف. كل الأطباق والأسعار توضيحية فقط.",storyPageKicker:"قصتنا",storyPageTitle:"سفرة يمنية، بعيداً عن اليمن.",storyPageIntro:"أزال مطعم يمني لمن يشتاق لهذا الطعام، ولمن يوشك أن يتذوقه لأول مرة.",storyValuesKicker:"كيف نطبخ",storyValuesTitle:"على مهل، وللمشاركة.",storyValuesText:"أغلب هذه الأطباق لا تُستعجل. نطبخها بالطريقة الطويلة، ونقدّمها في صحون مكانها وسط السفرة، ونترك المكان هادئاً بما يكفي للحديث.",majlisKicker:"المجلس",majlisTitle:"مكان محفوظ لك.",majlisText:"في البيت اليمني، المجلس هو الغرفة التي يُستقبل فيها الضيوف. مجلس أزال سيكون عضويتنا للزبائن الدائمين: نقاط على طلباتك، وأشياء نحفظها لأوائل أعضائنا. قريباً.",memberKicker:"مجلس أزال",memberTitle:"كُن من أهل الدار.",memberIntro:"مجلس أزال مجاني. انضم ببريدك، واكسب نقاطاً كلما استلمت طلباً، واستخدمها في وجبة لاحقة.",memberDemo:"قريباً",memberCardKicker:"مجلسك",memberStatusLabel:"العضوية",memberStatusValue:"قريباً",memberPointsLabel:"النقاط",memberPointsValue:"—",memberNotice:"التسجيل غير متاح بعد. لا شيء في هذه الصفحة ينشئ حساباً أو يطلب بياناتك.",memberSignIn:"تسجيل الدخول",memberJoin:"انضم إلى المجلس",memberDisabled:"قريباً",heroBottom:"جذور يمنية · مستقبل كندي",heroEyebrow:"مطبخ يمني · استلام وطاولات",heroTitle:"اليمن مطبوخاً على مهل،",heroTitleEm:"على سفرتك.",heroText:"مندي من حضرموت، وسلتة من صنعاء، وشاي من عدن. اطلب مسبقاً للاستلام، أو تعال واجلس معنا.",heroMenu:"شاهد القائمة",heroStory:"قصتنا",sampleNote:"معاينة · الأطباق والأسعار أمثلة",storyKicker:"الفكرة",storyTitle:"في اليمن، الضيف",storyTitleEm:"لا يأكل وحده أبداً.",storyText:"تأتي الوجبات اليمنية في صحون كبيرة وسط السفرة، ويمدّ الجميع أيديهم. أزال مبني حول هذه العادة: أطباق للمشاركة، ومكان تبقى فيه قليلاً.",menuKicker:"القائمة",menuTitle:"صُنعت",menuTitleEm:"للمشاركة.",menuIntro:"الأطباق والأسعار أمثلة بينما نستعد للافتتاح. الطلب غير متاح بعد.",demoLabel:"أطباق وأسعار للعرض فقط",searchLabel:"ابحث في القائمة",searchPlaceholder:"طبق أو مكوّن",catAll:"الكل",catRice:"أرز ولحم",catTraditional:"مرق",catSides:"مقبلات",catDrinks:"مشروبات",sufraKicker:"لا تعرف من أين تبدأ؟",sufraTitle:"اختر مزاجك،",sufraTitleEm:"ونحن ندلّك.",sufraIntro:"ثلاث طرق سهلة إلى القائمة.",sufraGroup:"طرق إلى القائمة",sufraWarm:"شيء دافئ",sufraWarmCopy:"مرق من الجبال",sufraRice:"أرز ولحم",sufraRiceCopy:"مندي وحنيذ",sufraSides:"مقبلات",sufraSidesCopy:"خبز، سحاوق، حمّص",sufraStatusInitial:"اختر واحدة للانتقال إلى ذلك الجزء من القائمة.",sufraStatusTraditional:"نعرض المرق والأطباق التقليدية.",sufraStatusRice:"نعرض أطباق الأرز واللحم.",sufraStatusSides:"نعرض المقبلات والأطباق الجانبية.",visitKicker:"زُرنا",visitTitle:"تعال وكُل معنا.",visitText:"نستعد للافتتاح. سننشر العنوان ورقم الهاتف هنا عند تأكيدهما.",visitCard:"أزال",visitCardTitle:"مكان واحد،",visitCardTitle2:"وترحيب دافئ واحد.",locationLabel:"أين",toAnnounce:"العنوان قريباً",addressLabel:"الهاتف",comingSoon:"قريباً",hoursLabel:"الساعات",footerTagline:"طعام يمني، صُنع للمشاركة.",footerLegal:"أزال · مطعم يمني · موقع معاينة",photoCreditsLabel:"الصور توضيحية وليست صور أزال. الحقوق:",cartKicker:"طلبك",cartTitle:"للاستلام",subtotal:"المجموع الفرعي",cartDisclaimer:"معاينة فقط: لا يُرسل شيء ولا يُخصم شيء.",checkoutButton:"متابعة",demoOnly:"معاينة",checkoutTitle:"اقتربنا.",checkoutText:"هذه المعاينة لا ترسل طلبك إلى المطبخ ولا تأخذ أي دفعة.",demoPickupOnly:"لا شيء تختاره هنا يُرسل أو يُحفظ أو يُخصم.",placeDemo:"شاهد المعاينة",add:"أضف",added:"أُضيف",noResults:"لا يوجد طبق يطابق ذلك. جرّب كلمة أخرى أو اعرض كل الأطباق.",emptyCart:"لا شيء هنا بعد. القائمة بداية جيدة.",each:"للواحد",removeOne:"أزل واحداً",addOne:"أضف واحداً",thankYou:"معاينة",demoContains:"طلبك سيتضمن",items:"صنف",notSent:"لم يُرسل شيء إلى المطعم.",cartLive:"أُضيف إلى طلبك: {dish}.",cartLiveRemoved:"أُزيل من طلبك: {dish}.",menuH1:"قائمة أزال",storyP1Title:"من أين يأتي الطعام",storyP1:"يتغير المطبخ اليمني مع أرضه: أرز ولحم مشوي على مهل في حضرموت، ومرق في المقالي الحجرية في جبال صنعاء، وشاي بالبهارات في ميناء عدن، وفاكهة من سهل البحر الأحمر. قائمتنا تتبع هذه الخريطة.",memberFounding:"أول 100 عضو سيُميَّزون كأعضاء مؤسسين.",memberHow1:"انضم مرة واحدة ببريدك.",memberHow2:"اطلب للاستلام؛ تُضاف النقاط بعد دفع طلبك واستلامه.",memberHow3:"استخدم نقاطك في طلب لاحق."}
};
const productTranslations = {
 1:{name:"Mandi d’agneau",say:"MANN-di",description:"Agneau et riz cuits ensemble jusqu’à ce que la viande soit fondante et le riz bien parfumé.",story:"Née dans l’Hadramaout : l’agneau et le riz cuisent ensemble, les sucs de la viande parfumant le riz en dessous.",type:"Riz et viandes",tag:"Spécialité"},
 2:{name:"Mandi au poulet",say:"MANN-di",description:"Poulet épicé sur riz mandi, rôti jusqu’à être doré.",story:"La même cuisson lente et fumée du mandi, plus légère avec le poulet, idéale à partager.",type:"Riz et viandes",tag:"Populaire"},
 3:{name:"Haneeth d’agneau",say:"ha-NIZ",description:"Agneau rôti lentement sur l’os, simplement assaisonné.",story:"Agneau rôti lentement en four fermé jusqu’à ce qu’il se détache de l’os, assaisonné simplement pour laisser parler la viande.",type:"Riz et viandes",tag:"Traditionnel"},
 4:{name:"Fahsa yéménite",say:"FAH-sa",description:"Ragoût de viande effilochée servi bouillant, avec du pain pour saucer.",story:"Un ragoût de viande effilochée servi bouillant dans une marmite en pierre, à saisir avec du pain chaud.",type:"Plats traditionnels"},
 5:{name:"Saltah yéménite",say:"SAL-ta",description:"Un ragoût chaud nappé de fenugrec fouetté, à manger avec du pain.",story:"Souvent appelé le plat national du Yémen : un ragoût mijoté couronné d’une mousse de fenugrec, au centre de la table.",type:"Plats traditionnels"},
 6:{name:"Sahawiq et pain frais",say:"sa-HA-wik",description:"Pain chaud et sauce fraîche au piment, tomate et ail.",story:"Une sauce fraîche de piment, tomate et ail présente à presque tous les repas yéménites, faite pour y tremper le pain.",type:"Accompagnements"},
 7:{name:"Houmous",say:"HOU-mous",description:"Purée de pois chiches onctueuse à l’huile d’olive.",story:"Un plat que se partagent bien des cuisines ; ici, une entrée douce aux côtés des plats yéménites.",type:"Accompagnements"},
 8:{name:"Thé adéni",say:"A-dé-ni tchaï",description:"Thé noir infusé au lait et aux épices douces.",story:"Le thé d’Aden : un thé noir corsé au lait et aux épices douces, comme on commence et finit un repas dans la ville portuaire.",type:"Boissons"},
 9:{name:"Jus de mangue frais",description:"Mangue mûre pressée, servie bien froide.",story:"Les mangues mûrissent sur la plaine côtière de la mer Rouge, la Tihama, et deviennent une boisson fraîche et douce.",type:"Boissons"}
};
let language=(()=>{try{const v=localStorage.getItem("azal-language");return v==="fr"||v==="ar"?v:"en"}catch{return "en"}})();
const t=key=>translations[language][key]||translations.en[key]||key;
const productTranslationsAr={1:{name:"مندي لحم",say:"",description:"يُطهى اللحم والأرز معًا حتى يطرى اللحم ويتشرّب الأرز نكهته.",story:"وُلد في حضرموت: يُطهى اللحم والأرز معًا، وتتساقط عصارة اللحم على الأرز المعطّر تحته.",type:"أرز ولحم",tag:"مميّز"},2:{name:"مندي دجاج",say:"",description:"دجاج متبّل على أرز المندي، يُشوى حتى يصبح ذهبياً.",story:"طريقة المندي نفسها، البطيئة والمدخّنة، أخف مع الدجاج ومحبوبة للمشاركة.",type:"أرز ولحم",tag:"الأكثر طلبًا"},3:{name:"حنيذ لحم",say:"",description:"لحم ضأن يُشوى على العظم على مهل، بتتبيلة بسيطة.",story:"لحم يُشوى ببطء في فرن مغلق حتى ينفصل عن العظم، بتتبيلة بسيطة كي يتكلم اللحم.",type:"أرز ولحم",tag:"تقليدي"},4:{name:"فحسة يمنية",say:"",description:"مرق لحم مفتّت يُقدَّم يغلي، مع خبز للغرف.",story:"مرق لحم مفتّت يُقدَّم يغلي في مقلى حجري، ويؤكل بغرفه بالخبز الساخن.",type:"مرق",tag:""},5:{name:"سلتة يمنية",say:"",description:"مرق ساخن تعلوه الحلبة المخفوقة، يؤكل بالخبز.",story:"يُسمّى كثيراً الطبق الوطني لليمن: مرق يغلي تعلوه الحلبة المخفوقة، وهو قلب السفرة.",type:"مرق",tag:""},6:{name:"سحاوق وخبز طازج",say:"",description:"خبز دافئ مع صلصة طازجة من الفلفل والطماطم والثوم.",story:"صلصة طازجة من الفلفل والطماطم والثوم ترافق كل وجبة يمنية تقريباً، صُنعت لتغمس فيها الخبز.",type:"مقبلات",tag:""},7:{name:"حمّص",say:"",description:"حمّص ناعم مهروس بزيت الزيتون.",story:"طبق تتشاركه مطابخ كثيرة، وهنا مقبّلة لطيفة على السفرة بجانب الأطباق اليمنية.",type:"مقبلات",tag:""},8:{name:"شاي عدني",say:"",description:"شاي أسود يُطبخ مع الحليب والبهارات الدافئة.",story:"شاي عدن: شاي أسود قوي بالحليب والبهارات الدافئة، ويُقدَّم في عدن في مستهل الوجبة وختامها.",type:"مشروبات",tag:""},9:{name:"عصير مانجو طازج",say:"",description:"مانجو ناضجة تُعصر وتُقدَّم باردة.",story:"ينضج المانجو في سهل تهامة على البحر الأحمر، ويُعصر شراباً بارداً حلواً.",type:"مشروبات",tag:""}};
const localizedProduct=p=>language==="fr"?{...p,...productTranslations[p.id]}:language==="ar"?{...p,...productTranslationsAr[p.id]}:p;
const NEXT_LANG={en:"fr",fr:"ar",ar:"en"},LANG_BTN={en:"EN",fr:"FR",ar:"ع"},LANG_ARIA={en:"Switch to English",fr:"Passer en français",ar:"التبديل إلى العربية"};
const LOCALES={en:"en-CA",fr:"fr-CA",ar:"ar-CA-u-nu-latn"};const locale=()=>LOCALES[language]||"en-CA";
function applyLanguage(){
 document.documentElement.lang=language;
 document.documentElement.dir=language==="ar"?"rtl":"ltr";
 try{localStorage.setItem("azal-language",language)}catch{}
 document.querySelectorAll("[data-i18n]").forEach(el=>{const key=el.dataset.i18n;if(t(key))el.textContent=t(key)});
 document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder)});
 document.querySelectorAll("[data-i18n-aria-label]").forEach(el=>{el.setAttribute("aria-label",t(el.dataset.i18nAriaLabel))});
 document.querySelectorAll("[data-i18n-alt]").forEach(el=>{el.setAttribute("alt",t(el.dataset.i18nAlt))});
 document.querySelectorAll("[data-i18n-title]").forEach(el=>{el.setAttribute("title",t(el.dataset.i18nTitle))});
 if(document.body&&document.body.dataset&&document.body.dataset.titleKey){const tt=t(document.body.dataset.titleKey);if(tt&&tt!==document.body.dataset.titleKey)document.title=tt}
 const switcher=$("languageToggle");
 if(typeof renderSufraN==="function")renderSufraN();
 if(typeof renderPickup==="function"&&typeof pickupState!=="undefined"&&pickupState.plan)renderPickup();
 const liveRegion=document.getElementById("cartStatus");if(liveRegion)liveRegion.textContent="";
 if(checkoutMessage)checkoutMessage.textContent="";if(typeof clearRitual==="function")clearRitual();
 [switcher,...document.querySelectorAll("[data-lang-quick]")].forEach(b=>{if(!b)return;const nx=NEXT_LANG[language];b.textContent=LANG_BTN[nx];b.setAttribute("aria-label",LANG_ARIA[nx]);b.setAttribute("lang",nx);b.removeAttribute("aria-pressed")})
 const active=tabs?.querySelector("button.active");
 renderProducts(active?.dataset.category||"All",search?.value||"");
 renderCart();
}
const products = [
{id:1,name:"Lamb Mandi",say:"MAN-dee",category:"Rice",type:"Rice & meat",price:24.99,description:"Lamb and rice cooked together until the meat is tender and the rice holds its flavour.",story:"Born in Hadramaut: lamb and rice cooked together, the meat's juices falling into the fragrant rice below.",image:"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",tag:"Signature"},
{id:2,name:"Chicken Mandi",say:"MAN-dee",category:"Rice",type:"Rice & meat",price:18.99,description:"Spiced chicken over mandi rice, roasted until golden.",story:"The same slow, smoky mandi method, lighter with chicken and a favourite for sharing.",image:"https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80",tag:"Popular"},
{id:3,name:"Lamb Haneeth",say:"ha-NEETH",category:"Rice",type:"Rice & meat",price:26.99,description:"Lamb slow-roasted on the bone, simply seasoned.",story:"Lamb roasted slowly in a sealed oven until it falls off the bone, seasoned simply so the meat speaks.",image:"https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",tag:"Traditional"},
{id:4,name:"Yemeni Fahsa",say:"FAH-sah",category:"Traditional",type:"Traditional",price:19.99,description:"Shredded meat stew served bubbling, with bread for scooping.",story:"A shredded-meat stew served sizzling in a stone pot, eaten by scooping it up with warm bread.",image:"https://commons.wikimedia.org/wiki/Special:FilePath/%D8%AE%D8%A8%D8%B2_%D9%85%D9%84%D9%88%D8%AD.jpg?width=900",tag:""},
{id:5,name:"Yemeni Saltah",say:"SAL-tah",category:"Traditional",type:"Traditional",price:17.99,description:"A hot stew finished with whipped fenugreek, eaten with bread.",story:"Often called Yemen’s national dish: a bubbling stew topped with whipped fenugreek, the table’s centrepiece.",image:"https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80",tag:""},
{id:6,name:"Sahawiq & Fresh Bread",say:"sa-HA-wik",category:"Sides",type:"Sides",price:5.99,description:"Warm bread with fresh chilli, tomato and garlic relish.",story:"A fresh chilli, tomato and garlic relish that sits beside nearly every Yemeni meal, made for tearing bread into.",image:"https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=900&q=80",tag:""},
{id:7,name:"Hummus",say:"HOOM-moos",category:"Sides",type:"Sides",price:7.99,description:"Smooth chickpea purée with olive oil.",story:"A dish many cuisines share, here a gentle starter to the table beside the Yemeni plates.",image:"https://commons.wikimedia.org/wiki/Special:FilePath/HummusLebanese.jpg?width=900",tag:""},
{id:8,name:"Adeni Chai",say:"AH-deh-nee chai",category:"Drinks",type:"Drinks",price:3.99,description:"Black tea brewed with milk and warm spices.",story:"Aden’s tea: strong black tea with milk and warm spices, the way the port city starts and ends a meal.",image:"https://commons.wikimedia.org/wiki/Special:FilePath/Chai_In_Sakora.jpg?width=900",tag:""},
{id:9,name:"Fresh Mango Juice",category:"Drinks",type:"Drinks",price:5.49,description:"Ripe mango, pressed and served cold.",story:"Mangoes ripen along Yemen’s Red Sea plain, the Tihama, and are pressed into a cool, sweet drink.",image:"https://commons.wikimedia.org/wiki/Special:FilePath/Mango_juice.JPG?width=900",tag:""}
];
function loadCart(){try{const saved=JSON.parse(localStorage.getItem("azal-demo-cart-v1")||"[]");if(!Array.isArray(saved))return new Map();return new Map(saved.filter(x=>Array.isArray(x)&&products.some(p=>p.id===Number(x[0]))&&Number.isInteger(Number(x[1]))&&Number(x[1])>0&&Number(x[1])<=50).map(x=>[Number(x[0]),Number(x[1])]))}catch{return new Map()}}
const cart = loadCart();
function persistCart(){try{localStorage.setItem("azal-demo-cart-v1",JSON.stringify([...cart.entries()]))}catch{}}
const $ = id => document.getElementById(id);
function announce(msg){const s=document.getElementById("cartStatus");if(!s)return;s.textContent="";if(typeof setTimeout==="function")setTimeout(()=>{s.textContent=msg},50);else s.textContent=msg;}
const dishName=id=>localizedProduct(products.find(p=>p.id===id)).name;
const money = n => new Intl.NumberFormat(locale(),{style:"currency",currency:"CAD"}).format(n);
const productGrid=$("productGrid"), cartDrawer=$("cartDrawer"), backdrop=$("cartBackdrop"), cartItems=$("cartItems");
const cartCount=$("cartCount"), cartTotal=$("cartTotal"), checkoutButton=$("checkoutButton");
const stickyCartBar=$("stickyCartBar"),stickyCartCount=$("stickyCartCount"),stickyCartTotal=$("stickyCartTotal");
const checkoutModal=$("checkoutModal"), checkoutMessage=$("checkoutMessage");
const nav=document.querySelector(".nav"), toggle=document.querySelector(".menu-toggle");
const search=$("menuSearch"), tabs=$("categoryTabs");
const sufraCompass=$("sufraCompass"), sufraStatus=$("sufraStatus");
let activeGuide=null; // C10: which Sufra guide (if any) is currently filtering the menu

function renderProducts(category="All",query=""){
 if(!productGrid)return;
 const normalized=query.trim().toLowerCase();
 const shown=products.filter(p=>{const v=localizedProduct(p);return (category==="All"||p.category===category)&&(!normalized||(`${p.name} ${p.description} ${p.type} ${v.name} ${v.description} ${v.type}`).toLowerCase().includes(normalized))});
 productGrid.innerHTML=shown.length?shown.map(p=>{const v=localizedProduct(p);return `<article class="product-card"><div class="product-image"><img src="${p.image}" alt="${v.name}" width="900" height="675" loading="lazy" decoding="async"></div>${v.tag?`<span class="product-tag">${v.tag}</span>`:""}<div class="product-info"><span class="product-category">${v.type}</span><h3>${v.name}</h3>${v.say?`<p class="say-it"><span class="say-label">${t("sayIt")}</span> <span class="say-sound">${v.say}</span></p>`:""}<p>${v.description}</p>${v.story?`<p class="dish-story">${v.story}</p>`:""}<div class="product-bottom"><span class="product-price">${money(p.price)}</span><button class="add-button" data-add="${p.id}">${cart.has(p.id)?t("added"):t("add")}</button></div></div></article>`}).join(""):`<p class="no-products">${t("noResults")}</p>`;
}
function renderCart(){
 const entries=[...cart.entries()], count=entries.reduce((sum,[,qty])=>sum+qty,0);
 const total=entries.reduce((sum,[id,qty])=>sum+products.find(p=>p.id===id).price*qty,0);
 if(cartCount)cartCount.textContent=count;
 if(cartTotal)cartTotal.textContent=money(total);
 if(stickyCartBar)stickyCartBar.hidden=count===0;
 if(stickyCartCount)stickyCartCount.textContent=count;
 if(stickyCartTotal)stickyCartTotal.textContent=money(total);
 if(checkoutButton)checkoutButton.disabled=count===0;
 if(cartItems)cartItems.innerHTML=entries.length?entries.map(([id,qty])=>{const p=products.find(x=>x.id===id);const v=localizedProduct(p);return `<div class="cart-row"><div><strong>${v.name}</strong><small>${money(p.price)} ${t("each")} · ${money(p.price*qty)}</small></div><div class="quantity-controls"><button data-change="${id}" data-delta="-1" aria-label="${t("removeOne")}">−</button><span>${qty}</span><button data-change="${id}" data-delta="1" aria-label="${t("addOne")}">+</button></div></div>`}).join(""):`<p class="empty-cart">${t("emptyCart")}</p>`;
 persistCart();
}
function openCart(){if(!cartDrawer||!backdrop)return;cartDrawer.classList.add("open");backdrop.classList.add("open");cartDrawer.setAttribute("aria-hidden","false");document.body.classList.add("locked")}
function closeCart(){cartDrawer?.classList.remove("open");backdrop?.classList.remove("open");cartDrawer?.setAttribute("aria-hidden","true");document.body.classList.remove("locked")}
function closeModal(){checkoutModal?.classList.remove("open");document.body.classList.remove("locked")}

// Render core content first: optional controls must never prevent the menu appearing.
renderProducts();
renderCart();

productGrid?.addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(!b)return;const id=Number(b.dataset.add);cart.set(id,(cart.get(id)||0)+1);renderCart();announce(t("cartLive").replace("{dish}",dishName(id)));const active=tabs?.querySelector("button.active");renderProducts(active?.dataset.category||"All",search?.value||"");});
cartItems?.addEventListener("click",e=>{const b=e.target.closest("[data-change]");if(!b)return;const id=Number(b.dataset.change),next=(cart.get(id)||0)+Number(b.dataset.delta);if(next<=0){cart.delete(id);announce(t("cartLiveRemoved").replace("{dish}",dishName(id)));}else cart.set(id,next);renderCart();const active=tabs?.querySelector("button.active");renderProducts(active?.dataset.category||"All",search?.value||"")});
tabs?.addEventListener("click",e=>{const b=e.target.closest("button[data-category]");if(!b)return;tabs.querySelectorAll("button").forEach(x=>{const active=x===b;x.classList.toggle("active",active);x.setAttribute("aria-pressed",String(active))});sufraCompass?.querySelectorAll("button[data-sufra-category]").forEach(x=>{const active=x.dataset.sufraCategory===b.dataset.category;x.classList.toggle("active",active);x.setAttribute("aria-pressed",String(active))});activeGuide=["Traditional","Rice","Sides"].includes(b.dataset.category)?b.dataset.category:null;if(sufraStatus)sufraStatus.textContent=["Traditional","Rice","Sides"].includes(b.dataset.category)?t("sufraStatus"+b.dataset.category):t("sufraStatusInitial");renderProducts(b.dataset.category,search?.value||"")});
search?.addEventListener("input",e=>{if(activeGuide&&e.target.value.trim()){activeGuide=null;sufraCompass?.querySelectorAll("button[data-sufra-category]").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-pressed","false")});tabs?.querySelectorAll("button[data-category]").forEach(x=>{const active=x.dataset.category==="All";x.classList.toggle("active",active);x.setAttribute("aria-pressed",String(active))});if(sufraStatus)sufraStatus.textContent=t("sufraStatusInitial")}const active=tabs?.querySelector("button.active");renderProducts(active?.dataset.category||"All",e.target.value)});
sufraCompass?.addEventListener("click",e=>{
 const b=e.target.closest("button[data-sufra-category]");
 if(!b)return;
 const category=b.dataset.sufraCategory;
 activeGuide=category;
 if(search)search.value="";
 tabs?.querySelectorAll("button[data-category]").forEach(x=>{const active=x.dataset.category===category;x.classList.toggle("active",active);x.setAttribute("aria-pressed",String(active))});
 sufraCompass.querySelectorAll("button[data-sufra-category]").forEach(x=>{const active=x===b;x.classList.toggle("active",active);x.setAttribute("aria-pressed",String(active))});
 renderProducts(category,"");
 if(sufraStatus)sufraStatus.textContent=t("sufraStatus"+category);
 const reducedMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 $("menu")?.scrollIntoView({behavior:reducedMotion?"auto":"smooth",block:"start"});
});

$("cartOpen")?.addEventListener("click",openCart);
 stickyCartBar?.addEventListener("click",openCart);
$("cartClose")?.addEventListener("click",closeCart);
backdrop?.addEventListener("click",closeCart);
checkoutButton?.addEventListener("click",()=>{if(checkoutModal){closeCart();pickupState.plan=null;pickupState.choice=null;pickupState.showAll=false;if(checkoutMessage)checkoutMessage.textContent="";if(typeof clearRitual==="function")clearRitual();renderPickup();checkoutModal.classList.add("open");document.body.classList.add("locked")}});
$("modalClose")?.addEventListener("click",closeModal);
$("placeDemoOrder")?.addEventListener("click",()=>{const count=[...cart.values()].reduce((a,b)=>a+b,0);if(typeof ritualKeys==="function"){ritualIds=[...cart.keys()];renderRitual();}if(checkoutMessage)checkoutMessage.textContent=`${t("thankYou")}. ${t("demoContains")} ${count} ${t("items")}. ${typeof pickupLabel==="function"?pickupLabel()+" ":""}${t("notSent")}`.replace(/\.\./g,".");cart.clear();renderCart();const active=tabs?.querySelector("button.active");renderProducts(active?.dataset.category||"All",search?.value||"")});
checkoutModal?.addEventListener("click",e=>{if(e.target.id==="checkoutModal")closeModal()});
toggle?.addEventListener("click",()=>{const open=nav?.classList.toggle("open")||false;toggle.setAttribute("aria-expanded",String(open))});
nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");toggle?.setAttribute("aria-expanded","false")}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();closeModal();nav?.classList.remove("open");toggle?.setAttribute("aria-expanded","false")}});
if($("year"))$("year").textContent=new Date().getFullYear();

[$("languageToggle"),...document.querySelectorAll("[data-lang-quick]")].forEach(b=>b?.addEventListener("click",()=>{language=NEXT_LANG[language]||"en";applyLanguage()}));
applyLanguage();

/* Sufra for N (Claude, prototype): suggest a shared spread for a table size. Illustrative only. */
function sufraSpread(n){
 const g=Math.max(1,Math.min(12,Math.round(Number(n)||0)));const half=Math.ceil(g/2);
 const lines=[[1,Math.ceil(half/2)],[2,Math.floor(half/2)],[5,1],[4,g>=6?1:0],[6,half],[7,g>=6?2:1],[8,g]];
 return lines.filter(([,q])=>q>0).map(([id,qty])=>({id,qty}));
}
var sfnSize=null,sfnLines=[];const sufraN=document.getElementById("sufraN");
function renderSufraN(){
 const root=document.getElementById("sufraN");if(!root)return;
 root.querySelectorAll("button[data-sfn-size]").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.sfnSize)===sfnSize)));
 const list=document.getElementById("sfnList"),foot=document.getElementById("sfnFoot");if(!list||!foot)return;
 if(!sfnSize){list.innerHTML="";foot.hidden=true;return}
 const live=sfnLines.filter(l=>l.qty>0);
 if(!live.length){list.innerHTML=`<li class="sfn-empty">${t("sfnEmpty")}</li>`;foot.hidden=true;return}
 list.innerHTML=live.map(l=>{const p=products.find(x=>x.id===l.id),v=localizedProduct(p);return `<li class="sfn-line"><span class="sfn-name">${v.name}</span><span class="sfn-qty"><button type="button" data-sfn-change="${l.id}" data-delta="-1" aria-label="${t("removeOne")}: ${v.name}">−</button><span aria-live="off">${l.qty}</span><button type="button" data-sfn-change="${l.id}" data-delta="1" aria-label="${t("addOne")}: ${v.name}">+</button></span></li>`}).join("");
 const total=live.reduce((s,l)=>s+products.find(p=>p.id===l.id).price*l.qty,0);
 document.getElementById("sfnTotalValue").textContent=money(total);foot.hidden=false;
}
sufraN?.addEventListener("click",e=>{
 const size=e.target.closest("button[data-sfn-size]");
 if(size){sfnSize=Number(size.dataset.sfnSize);sfnLines=sufraSpread(sfnSize);renderSufraN();return}
 const ch=e.target.closest("button[data-sfn-change]");
 if(ch){const l=sfnLines.find(x=>x.id===Number(ch.dataset.sfnChange));if(l)l.qty=Math.max(0,Math.min(20,l.qty+Number(ch.dataset.delta)));renderSufraN();return}
 if(e.target.closest("#sfnAdd")){const live=sfnLines.filter(l=>l.qty>0);if(!live.length)return;live.forEach(l=>cart.set(l.id,(cart.get(l.id)||0)+l.qty));renderCart();const active=tabs?.querySelector("button.active");renderProducts(active?.dataset.category||"All",search?.value||"");announce(t("sfnAdded").replace("{n}",sfnSize).replace("{count}",live.reduce((a,l)=>a+l.qty,0)));}
});

/* P3 pickup-time step, INERT PREVIEW (Claude). Rules = docs/p3-pickup-ui.md defaults; no backend, nothing sent or stored. */
const PICKUP={open:660,close:1260,prep:20,step:15,last:1245,tz:"America/Toronto",freshExample:[720,810,1080]}; /* freshExample = EXAMPLE oven-batch times (12:00, 13:30, 18:00), not real; the kitchen sets them (Tier C) */
const isFresh=m=>Array.isArray(PICKUP.freshExample)&&PICKUP.freshExample.includes(m);
function pickupPlan(nowMin,c){
 const first=c.open+c.prep,up=(m,s)=>Math.ceil(m/s)*s,range=(a)=>{const out=[];for(let m=a;m<=c.last;m+=c.step)out.push(m);return out};
 if(nowMin<c.open)return {status:"before_open",day:"today",asap:null,slots:range(up(first,c.step))};
 if(up(nowMin+c.prep,5)>c.last)return {status:"closed_today",day:"tomorrow",asap:null,slots:range(up(first,c.step))};
 const asap=Math.max(up(nowMin+c.prep,5),first);
 return {status:"open",day:"today",asap,slots:range(up(asap+1,c.step))};
}
function torontoMinutes(d){try{const p=new Intl.DateTimeFormat("en-CA",{timeZone:PICKUP.tz,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d);return Number(p.find(x=>x.type==="hour").value)*60+Number(p.find(x=>x.type==="minute").value)}catch{return d.getHours()*60+d.getMinutes()}}
const oneDot=x=>x.replace(/\.\./g,".");
function fmtMin(m){return new Intl.DateTimeFormat(locale(),{hour:"numeric",minute:"2-digit",timeZone:"UTC"}).format(new Date(Date.UTC(2026,0,1,Math.floor(m/60),m%60)))}
var pickupState={choice:null,showAll:false,plan:null};
function renderPickup(){
 const box=document.getElementById("pickupOptions");if(!box)return;
 const plan=pickupState.plan||(pickupState.plan=pickupPlan(torontoMinutes(new Date()),PICKUP));
 if(pickupState.choice===null)pickupState.choice=plan.asap!==null?"asap":String(plan.slots[0]);
 const note=document.getElementById("pickupNote");
 if(note)note.textContent=oneDot(plan.status==="before_open"?t("pickupBeforeOpen").replace("{time}",fmtMin(PICKUP.open)):plan.status==="closed_today"?t("pickupClosedToday").replace("{day}",t("pickupTomorrow")).replace("{time}",fmtMin(plan.slots[0])):"");
 const radio=(val,label,cls)=>`<label class="${cls}"><input type="radio" name="pickup" value="${val}"${pickupState.choice===val?" checked":""}><span>${label}</span></label>`;
 const shown=pickupState.showAll?plan.slots:plan.slots.slice(0,8);
 box.innerHTML=(plan.asap!==null?radio("asap",t("pickupAsap").replace("{time}",fmtMin(plan.asap)),"pickup-asap"):"")+
  `<p class="pickup-later" id="pickupLaterLabel">${plan.asap!==null?t("pickupLater"):t("pickupLaterTomorrow")}</p><div class="pickup-slots" role="group" aria-labelledby="pickupLaterLabel">`+shown.map(m=>isFresh(m)?radio(String(m),`${fmtMin(m)}<small class="fresh-tag" aria-hidden="true">${t("pickupFreshShort")}</small><span class="visually-hidden">, ${t("pickupFreshLong")}</span>`,"pickup-slot is-fresh"):radio(String(m),fmtMin(m),"pickup-slot")).join("")+`</div>`+(shown.some(isFresh)?`<p class="fresh-note">${t("pickupFreshNote")}</p>`:"")+
  (!pickupState.showAll&&plan.slots.length>8?`<button type="button" class="text-link dark-link pickup-more" id="pickupMore">${t("pickupMore")}</button>`:"");
 const tz=document.getElementById("pickupTz");
 if(tz){let local="";try{local=Intl.DateTimeFormat().resolvedOptions().timeZone}catch{}tz.hidden=local===PICKUP.tz}
}
function pickupLabel(){const plan=pickupState.plan;if(!plan)return "";const v=pickupState.choice;const time=v==="asap"?fmtMin(plan.asap):fmtMin(Number(v));return t("pickupChosen").replace("{time}",(plan.day==="tomorrow"?t("pickupTomorrow")+" ":"")+time)}
document.addEventListener("change",e=>{if(e.target&&e.target.name==="pickup"){pickupState.choice=e.target.value}});
document.addEventListener("click",e=>{if(e.target&&e.target.id==="pickupMore"){pickupState.showAll=true;renderPickup();document.querySelector('.pickup-slots input[type="radio"]:not(:checked)')?.focus()}});

/* "Eat it the Yemeni way" serving-ritual PREVIEW (Claude). Rules = docs/serving-ritual.md; DRAFT until the kitchen confirms. Inert. */
function ritualKeys(ids){
 const has=id=>ids.includes(id),out=[];
 const stew=has(4)||has(5),platter=has(1)||has(2)||has(3),bread=has(6),chai=has(8),juice=has(9);
 if(!stew&&!platter&&!bread)return [];
 if(stew)out.push("ritualStew");
 if(platter)out.push("ritualPlatter");
 if(bread&&!stew&&out.length<2)out.push("ritualBread");
 out.push(chai?"ritualChai":juice?"ritualJuice":"ritualClose");
 return out.slice(0,3);
}
var ritualIds=[];
function renderRitual(){
 const box=document.getElementById("ritualPreview");if(!box)return;
 const keys=ritualKeys(ritualIds);
 if(!keys.length){box.hidden=true;box.innerHTML="";return}
 box.innerHTML=`<p class="ritual-title">${t("ritualTitle")}</p><ol>${keys.map(k=>`<li>${t(k)}</li>`).join("")}</ol><p class="ritual-draft">${t("ritualDraft")}</p>`;
 box.hidden=false;
}
function clearRitual(){ritualIds=[];const box=document.getElementById("ritualPreview");if(box){box.hidden=true;box.innerHTML=""}}
