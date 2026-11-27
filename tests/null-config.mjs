// Browser tests run against demo mode by default: the shipped supabase-config.js is live since activation
// (3251974), so every new page gets a null config unless the test routes its own fake config (later routes win).
// Tests must never reach the real Supabase project.
export function nullConfig(browser) {
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (opts) => {
    const p = await newPage(opts);
    await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: "window.AZAL_SUPABASE=Object.freeze({url:null,anonKey:null});" }));
    return p;
  };
  return browser;
}
