// Provisional AZAL reservation defaults selected by Muse (2026-11-25).
// This is a single display/config source while P2 schema work is frozen.
// After the schema baseline and migration gate, replace the static values with the
// approved read-only opening_hours settings row. This file never enables booking.
window.AZAL_RESERVATION_CONFIG = Object.freeze({
  timezone: "America/Toronto",
  openingDays: [0, 1, 2, 3, 4, 5, 6], // daily; editable through the future settings row
  openingTime: "11:00",
  closingTime: "21:00",
  durationMinutes: 60,
  slotIntervalMinutes: 30,
  totalSeats: 50,
  maxPartySize: 10,
  depositRequired: false,
  guestFields: Object.freeze(["name", "mobilePhone", "email", "partySize", "dateTime"]), // owner rule 07:48: table only, these and nothing else
  phoneRequired: true,
  notificationMethod: "email",
  notificationEmail: "info@azalrestaurant.com", // owner rule 07:48 (via Muse 07:50); display/config only. Booking emails are sent by the server outbox sender (not built yet)
  bookingEnabled: false,
  goLiveAuthorized: false
});
