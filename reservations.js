const applyReservationCopy = () => {
  const locale = document.documentElement.lang === "fr" ? "fr" : "en";
  document.querySelectorAll("[data-res-en][data-res-fr]").forEach((element) => {
    element.textContent = locale === "fr" ? element.dataset.resFr : element.dataset.resEn;
  });
  document.querySelectorAll("[data-res-aria-en][data-res-aria-fr]").forEach((element) => {
    element.setAttribute("aria-label", locale === "fr" ? element.dataset.resAriaFr : element.dataset.resAriaEn);
  });
};

// script.js owns the shared language toggle; this page only translates its local copy.
document.getElementById("languageToggle")?.addEventListener("click", applyReservationCopy);
applyReservationCopy();
