/* AZAL restaurant NEW_ORDER email presentation + fail-closed provider adapter.
   No SMTP transport or credentials are configured here. */
(function (root) {
  "use strict";
  const DEFAULT_SITE_URL = "https://aalshalfi.github.io/azal-restaurant/";
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const money = (cents, locale) => new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    style: "currency", currency: "CAD"
  }).format((Number.isFinite(Number(cents)) ? Number(cents) : 0) / 100);
  const dateTime = (value, locale) => {
    if (!value || !Number.isFinite(new Date(value).getTime())) return locale === "fr" ? "À confirmer" : "To be confirmed";
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
      dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto"
    }).format(new Date(value));
  };
  const siteBase = (value) => {
    const raw = String(value || DEFAULT_SITE_URL);
    return raw.endsWith("/") ? raw : raw + "/";
  };

  function renderNewOrderEmail(order, options = {}) {
    if (!order || typeof order !== "object" || !Array.isArray(order.items) || !order.items.length) {
      throw new TypeError("invalid_order_payload");
    }
    const locale = options.locale === "fr" ? "fr" : "en";
    const base = siteBase(options.siteUrl);
    const staffUrl = new URL(String(order.staff_queue_path || "staff.html").replace(/^\/+/, ""), base).href;
    const logoUrl = new URL("assets/azal-logo.svg", base).href;
    const orderNo = String(order.order_number || String(order.order_id || "").slice(0, 8).toUpperCase()).replace(/[\r\n]/g, "").slice(0, 32);
    const hOrderNo = escapeHtml(orderNo);
    const branch = String(order.branch && order.branch.name || order.branch_name || "AZAL");
    const hBranch = escapeHtml(branch);
    const labels = locale === "fr"
      ? { title: "NOUVELLE COMMANDE", intro: "Une nouvelle commande payée attend la cuisine.", branch: "Succursale", placed: "Reçue", pickup: "Ramassage", item: "Article", qty: "Qté", unit: "Prix unitaire", line: "Total", subtotal: "Sous-total", discount: "Rabais", tax: "Taxes", total: "Total à payer", note: "Note pour la cuisine", open: "Ouvrir la file cuisine", footer: "AZAL · info@azalrestaurant.com. Notification automatique; la file cuisine authentifiée demeure la source officielle." }
      : { title: "NEW ORDER", intro: "A newly paid order is waiting for the kitchen.", branch: "Branch", placed: "Placed", pickup: "Pickup", item: "Item", qty: "Qty", unit: "Unit price", line: "Line total", subtotal: "Subtotal", discount: "Discount", tax: "Tax", total: "Total paid", note: "Kitchen note", open: "Open kitchen queue", footer: "AZAL · info@azalrestaurant.com. Automated notification; the authenticated kitchen queue is the source of truth." };
    const items = order.items.map((item) => ({
      name: String(item.name || item.item_name || "Item"),
      qty: Math.max(0, Number(item.quantity) || 0),
      unit: money(item.unit_price_cents, locale),
      line: money(item.line_total_cents, locale)
    }));
    const rows = items.map((item) => "<tr><td style=\"padding:12px 8px;border-bottom:1px solid #eadfce\">" + escapeHtml(item.name) +
      "</td><td style=\"padding:12px 8px;text-align:center;border-bottom:1px solid #eadfce\">" + item.qty +
      "</td><td style=\"padding:12px 8px;text-align:right;border-bottom:1px solid #eadfce\">" + item.unit +
      "</td><td style=\"padding:12px 8px;text-align:right;border-bottom:1px solid #eadfce\">" + item.line + "</td></tr>").join("");
    const subtotal = money(order.subtotal_cents, locale);
    const discount = Number(order.discount_cents) > 0 ? money(order.discount_cents, locale) : null;
    const tax = money(order.tax_cents, locale);
    const total = money(order.total_cents, locale);
    const note = String(order.customer_note || "").trim();
    const pickup = dateTime(order.pickup_at, locale);
    const placed = dateTime(order.placed_at, locale);
    const html = "<!doctype html><html lang=\"" + locale + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + labels.title + " #" + hOrderNo + "</title></head>" +
      "<body style=\"margin:0;background:#f8f1e7;color:#42220e;font-family:Arial,Helvetica,sans-serif\"><table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#f8f1e7;padding:24px 8px\"><tr><td align=\"center\">" +
      "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;background:#fffdf9;border:1px solid #eadfce;border-radius:14px;overflow:hidden\"><tr><td style=\"padding:24px 28px;background:#42220e;text-align:center\"><img src=\"" + escapeHtml(logoUrl) + "\" width=\"132\" alt=\"AZAL\" style=\"display:block;width:132px;max-width:45%;height:auto;margin:0 auto 16px\"><div style=\"font-size:13px;letter-spacing:2px;color:#e7bd72;font-weight:bold\">" + labels.title + "</div><div style=\"font-size:30px;line-height:1.2;color:#fff;font-weight:bold;margin-top:8px\">#" + hOrderNo + "</div></td></tr>" +
      "<tr><td style=\"padding:26px 28px\"><p style=\"margin:0 0 18px;font-size:16px;line-height:1.5\">" + labels.intro + "</p><table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\"><tr><td style=\"padding:8px 0;color:#806b58\">" + labels.branch + "</td><td align=\"right\" style=\"padding:8px 0;font-weight:bold\">" + hBranch + "</td></tr><tr><td style=\"padding:8px 0;color:#806b58\">" + labels.placed + "</td><td align=\"right\" style=\"padding:8px 0\">" + escapeHtml(placed) + "</td></tr><tr><td style=\"padding:8px 0;color:#806b58\">" + labels.pickup + "</td><td align=\"right\" style=\"padding:8px 0;font-weight:bold\">" + escapeHtml(pickup) + "</td></tr></table>" +
      "<h2 style=\"font-size:16px;margin:26px 0 8px\">" + (locale === "fr" ? "Détails de la commande" : "Order details") + "</h2><table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:collapse;font-size:13px\"><thead><tr style=\"background:#f4eadb\"><th align=\"left\" style=\"padding:10px 8px\">" + labels.item + "</th><th>" + labels.qty + "</th><th align=\"right\">" + labels.unit + "</th><th align=\"right\">" + labels.line + "</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin-top:18px;font-size:14px\"><tr><td style=\"padding:5px 0\">" + labels.subtotal + "</td><td align=\"right\">" + subtotal + "</td></tr>" +
      (discount ? "<tr><td style=\"padding:5px 0\">" + labels.discount + "</td><td align=\"right\">−" + discount + "</td></tr>" : "") +
      "<tr><td style=\"padding:5px 0\">" + labels.tax + "</td><td align=\"right\">" + tax + "</td></tr><tr><td style=\"padding:12px 0;border-top:1px solid #d8c5aa;font-size:17px;font-weight:bold\">" + labels.total + "</td><td align=\"right\" style=\"padding:12px 0;border-top:1px solid #d8c5aa;font-size:17px;font-weight:bold;color:#914820\">" + total + "</td></tr></table>" +
      (note ? "<div style=\"margin-top:20px;padding:14px;background:#f8f1e7;border-radius:8px\"><strong>" + labels.note + "</strong><div style=\"margin-top:6px;white-space:pre-wrap\">" + escapeHtml(note) + "</div></div>" : "") +
      "<p style=\"margin:26px 0 0;text-align:center\"><a href=\"" + escapeHtml(staffUrl) + "\" style=\"display:inline-block;padding:13px 22px;background:#cd8e2d;color:#42220e;text-decoration:none;border-radius:7px;font-weight:bold\">" + labels.open + "</a></p></td></tr><tr><td style=\"padding:18px 28px;background:#f4eadb;color:#806b58;font-size:12px;line-height:1.5;text-align:center\">" + labels.footer + "</td></tr></table></td></tr></table></body></html>";
    const textLines = [
      "AZAL — " + labels.title + " #" + orderNo, labels.intro,
      labels.branch + ": " + branch, labels.placed + ": " + placed, labels.pickup + ": " + pickup, "",
      labels.item + " | " + labels.qty + " | " + labels.unit + " | " + labels.line,
      ...items.map((item) => item.name + " | " + item.qty + " | " + item.unit + " | " + item.line), "",
      labels.subtotal + ": " + subtotal,
      ...(discount ? [labels.discount + ": -" + discount] : []),
      labels.tax + ": " + tax, labels.total + ": " + total,
      ...(note ? ["", labels.note + ": " + note] : []), "",
      labels.open + ": " + staffUrl, labels.footer
    ];
    return { subject: (locale === "fr" ? "Nouvelle commande AZAL" : "New AZAL order") + " #" + orderNo, html, text: textLines.join("\n") };
  }

  function createSender({ provider, enabled = false } = {}) {
    return {
      async send({ to, order, siteUrl, locale } = {}) {
        if (!enabled) return { status: "blocked", reason: "sender_disabled" };
        if (!provider || typeof provider.send !== "function") throw new TypeError("provider_required");
        if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to))) throw new TypeError("invalid_recipient");
        const message = renderNewOrderEmail(order, { siteUrl, locale });
        const result = await provider.send({ to: String(to), ...message });
        return { status: "sent", provider_message_id: result && result.id ? String(result.id) : null };
      }
    };
  }

  const api = { escapeHtml, renderNewOrderEmail, createSender };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AzalOrderEmail = api;
})(typeof window !== "undefined" ? window : globalThis);
