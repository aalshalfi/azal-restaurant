// AZAL Supabase client configuration (Claude, ACCT).
// The URL and the anon (publishable) key are filled by the lead at merge time, never in a branch.
// While either is null, every account feature on the site stays inert: no form is shown, no request is sent,
// nothing about the visitor is collected. Never put a service-role or secret key in this file.
window.AZAL_SUPABASE = Object.freeze({
  url: null,
  anonKey: null
});
