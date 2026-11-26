const applyMemberCopy = () => {
  const locale = document.documentElement.lang === "fr" ? "fr" : "en";
  document.querySelectorAll("[data-member-en][data-member-fr]").forEach((element) => {
    element.textContent = locale === "fr" ? element.dataset.memberFr : element.dataset.memberEn;
  });
  document.querySelectorAll("[data-member-aria-en][data-member-aria-fr]").forEach((element) => {
    element.setAttribute("aria-label", locale === "fr" ? element.dataset.memberAriaFr : element.dataset.memberAriaEn);
  });
};

// script.js registers its language toggle first; this listener then refreshes member-only copy.
document.getElementById("languageToggle")?.addEventListener("click", applyMemberCopy);
applyMemberCopy();
