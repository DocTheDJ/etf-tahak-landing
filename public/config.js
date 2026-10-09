// Public, client-side settings. Fill the IDs before launching ads (see README > Launch checklist).
// Everything here is safe to expose. Server secrets live in Vercel env vars.
window.ETF_CONFIG = {
  // Third-party measurement. Loaded only after the visitor accepts the consent bar.
  // The consent bar itself only appears once at least one of these is set.
  ga4Id: "",            // "G-XXXXXXXXXX"
  metaPixelId: "",      // "123456789012345"
  posthogKey: "",       // "phc_..."
  posthogHost: "https://eu.i.posthog.com",

  // Shown in the footer. Legally required in CZ for commercial communication: name + IČO.
  operator: "Demo projekt. Provozovatel (název, IČO) bude doplněn před spuštěním.",

  pdfUrl: "/tahak/etf-tahak-2026.pdf",

  experiments: {
    // H2 in README: ask for the email in the twins hero (early) vs. only after the proof (late).
    // Off = everyone gets "early". Force a variant with ?ask=early|late.
    ask: { enabled: false },
  },
};
