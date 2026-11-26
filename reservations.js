const reservationConfig = window.AZAL_RESERVATION_CONFIG || null;

const applyReservationCopy = () => {
  const locale = document.documentElement.lang === "fr" ? "fr" : "en";
  document.querySelectorAll("[data-res-en][data-res-fr]").forEach((element) => {
    element.textContent = locale === "fr" ? element.dataset.resFr : element.dataset.resEn;
  });
  document.querySelectorAll("[data-res-aria-en][data-res-aria-fr]").forEach((element) => {
    element.setAttribute("aria-label", locale === "fr" ? element.dataset.resAriaFr : element.dataset.resAriaEn);
  });
};

const applyReservationSettings = () => {
  if (!reservationConfig) return;
  const locale = document.documentElement.lang === "fr" ? "fr" : "en";
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  const days = Array.isArray(reservationConfig.openingDays) ? reservationConfig.openingDays : [];
  const names = locale === "fr"
    ? ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayLabel = days.length === 7
    ? (locale === "fr" ? "Tous les jours" : "Daily")
    : days.map((day) => names[day]).filter(Boolean).join(", ");
  const timeRange = reservationConfig.openingTime + "–" + reservationConfig.closingTime;
  const maxParty = Number(reservationConfig.maxPartySize);
  const seats = Number(reservationConfig.totalSeats);
  const duration = Number(reservationConfig.durationMinutes);

  setText("reservationDuration", duration + " minutes");
  setText("reservationPartyLimit", locale === "fr" ? "Jusqu’à " + maxParty + " personnes" : "Up to " + maxParty + " guests");
  setText("reservationTotalSeats", locale === "fr" ? seats + " places" : seats + " seats");
  setText(
    "reservationDeposit",
    reservationConfig.depositRequired
      ? (locale === "fr" ? "Dépôt requis" : "Deposit required")
      : (locale === "fr" ? "Aucun dépôt requis" : "No deposit required")
  );
  setText("reservationDays", dayLabel);
  setText("reservationHours", timeRange);

  setText(
    "reservation-party-note",
    locale === "fr"
      ? "Groupe maximal : " + maxParty + " personnes; capacité totale : " + seats + " places."
      : "Largest party: " + maxParty + " guests; total dining capacity: " + seats + " seats."
  );
  setText(
    "reservation-email-note",
    locale === "fr"
      ? "Les avis de réservation seront envoyés par courriel; l’adresse de réception sera configurée au lancement."
      : "Reservation notices will be sent by email; the receiving address will be configured at launch."
  );
  setText(
    "reservation-go-live-note",
    locale === "fr"
      ? "La réservation en ligne reste désactivée jusqu’à l’autorisation explicite de mise en service."
      : "Online booking remains disabled until explicit go-live approval."
  );

  const partyInput = document.getElementById("party-size");
  if (partyInput) {
    partyInput.max = String(maxParty);
    partyInput.placeholder = "1–" + maxParty;
    partyInput.disabled = true;
  }
  const partyLabel = document.querySelector('label[for="party-size"]');
  if (partyLabel) {
    partyLabel.textContent = locale === "fr"
      ? "Nombre de personnes (jusqu’à " + maxParty + ")"
      : "Number of guests (up to " + maxParty + ")";
  }
  const timeOption = document.querySelector("#booking-time option");
  if (timeOption) {
    timeOption.textContent = locale === "fr"
      ? "Les heures seront affichées à l’ouverture"
      : "Times appear when booking opens";
  }

  // This page remains inert regardless of display settings until the separate go-live gate.
  const submit = document.getElementById("reservation-submit");
  if (submit) {
    submit.disabled = true;
    submit.setAttribute("aria-disabled", "true");
  }
};

const applyReservationPage = () => {
  applyReservationCopy();
  applyReservationSettings();
};

// script.js owns the shared language toggle; this page only updates its local copy/settings.
document.getElementById("languageToggle")?.addEventListener("click", applyReservationPage);
applyReservationPage();
