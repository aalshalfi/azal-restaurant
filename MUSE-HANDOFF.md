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


## OWNER AUTHORIZATION — AUTONOMOUS WEBSITE DEVELOPMENT (2026-11-25)
The owner grants ChatGPT and Muse ongoing permission to independently plan, implement, improve, test, and refine the AZAL website without requesting approval for each routine development decision.

### Authorized work
- Implement design, layout, responsive, accessibility, SEO, performance, code-quality, and reliability improvements.
- Build a polished bilingual English/French experience, including a language switch and translated interface/copy.
- Keep illustrative/demo food photography for now. Muse may use suitable images already available in the owner's supplied project/brand assets when their source and usage rights are clear; otherwise use clearly illustrative assets with appropriate rights. Do not represent stock images as actual AZAL food photography.
- Keep the sample menu, sample prices, cart, and checkout visible as a demo. Clearly state that no real order is transmitted and no payment is collected.
- Improve demo interactions and test the published site after changes.
- Coordinate directly through the repository reply files; do not wait for per-task approval.

### Boundaries that remain in force
- Never invent or publish a real address, phone number, hours, final menu/prices, social accounts, reviews, awards, delivery coverage, or other unconfirmed business facts.
- Never activate real ordering, payment processing, reservations, delivery integrations, or collection of customer personal/payment data.
- Do not spend money, purchase domains/services, create paid subscriptions, or change account/billing settings.
- Preserve the AZAL logo and brand palette (#42220E, #CD8E2D, #914820, #F8F1E7); do not make a brand-identity change.
- Do not delete source assets or perform destructive/irreversible repository or deployment actions. Use focused commits and preserve rollback paths.
- If a task crosses one of these boundaries or requires a real-world business fact, leave it clearly marked as pending rather than asking about routine design choices.
- Verify builds and the live URL before reporting success. Report commits, changed files, test results, and blockers.

This authorization replaces any earlier instruction to pause for approval on routine design, bilingual presentation, demo imagery, or other ordinary website-development decisions.
