# Handoff note for Muse — AZAL website

This file is a coordination note for the AI/developer agent working on this repository. Please read it before making further changes.

## Project context
- Repository: https://github.com/aalshalfi/azal-restaurant
- Brand: AZAL — a Yemeni restaurant concept in development.
- Important: there is not yet a confirmed operating restaurant, branch address, opening schedule, final menu, or live ordering/payment system.
- Preserve the existing AZAL logo and supplied brand palette. Do not redesign the logo.
- Brand palette: deep brown #42220E, heritage gold #CD8E2D, clay #914820, ivory #F8F1E7.

## Recent work already committed
Recent updates on `main` include:
- Improved homepage copy and concept-preview messaging.
- Added Open Graph and basic social-sharing metadata.
- Added a live menu search field alongside category filters.
- Added skip navigation, clearer mobile navigation labeling, keyboard Escape handling, focus styles, and reduced-motion support.
- Kept sample dishes/prices and demo checkout clearly marked as illustrative only.

Please inspect the current `index.html`, `styles.css`, and `script.js` before editing; do not assume this note describes every current line.

## What we want you to do
1. Review the site against excellent restaurant websites: clear visual hierarchy, appetite appeal, mobile-first usability, fast loading, accessible navigation, and a simple path through the menu.
2. Compare patterns from strong restaurant websites, but create an original AZAL experience. Do not copy another restaurant's branding or layout verbatim.
3. Audit the current implementation for broken interactions, responsive issues, accessibility problems, SEO basics, image performance, and maintainability.
4. Recommend and implement only improvements that make sense for a restaurant concept that is not open yet.
5. Keep all sample food items and prices visibly identified as examples. Do not imply that visitors can place real orders.
6. Do not invent a physical address, phone number, opening hours, social accounts, customer reviews, awards, delivery coverage, or business claims.
7. Do not connect real payments, delivery platforms, reservations, or customer-data collection.
8. Preserve the existing logo and palette. If you believe a change is necessary, explain why before changing the brand identity.

## Coordination / safety
- Make changes in a focused, reviewable way and summarize every changed file.
- Do not delete assets or rewrite large sections unnecessarily.
- Do not claim deployment succeeded unless you verify the published URL.
- If a decision requires information from the owner (real menu, location, photos, contact details), leave a clear TODO and ask rather than guessing.
- Please reply with your audit findings, the improvements you made, and any owner decisions still needed.

This note is a handoff message only. It does not grant permission to invent business details or activate real customer-facing transactions.
