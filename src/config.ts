// Public settings for the browser. Values come from PUBLIC_* environment variables declared in
// astro.config.mjs (set them in Vercel, then redeploy), so launching ads needs no code change.
// They end up in the browser bundle: never put secrets here.
import {
  PUBLIC_GA4_ID,
  PUBLIC_META_PIXEL_ID,
  PUBLIC_POSTHOG_KEY,
  PUBLIC_OPERATOR,
  PUBLIC_EXP_ASK,
} from "astro:env/client";

export const config = {
  // Cookie-based tools (ad measurement): loaded only after consent. The consent bar appears only if one is set.
  ga4Id: PUBLIC_GA4_ID,
  metaPixelId: PUBLIC_META_PIXEL_ID,

  // PostHog product analytics, EU Cloud, in COOKIELESS mode: nothing is stored on the device, so it runs from the
  // first visit without a banner. Requests go through our own domain (vercel.json rewrite /rq7 → eu.i.posthog.com)
  // so ad blockers don't drop them. Empty key = PostHog is off.
  posthogKey: PUBLIC_POSTHOG_KEY,
  posthogProxy: "/rq7",
  posthogUiHost: "https://eu.posthog.com",

  // Footer + privacy page. Legally required in CZ for commercial communication (name + IČO).
  operator: PUBLIC_OPERATOR || "Demo projekt. Provozovatel (název, IČO) bude doplněn před spuštěním.",

  pdfUrl: "/tahak/etf-tahak-2026.pdf",

  // A/B test "ask" on the twins page (README, hypothesis 2): form in the hero vs. only after the proof.
  // Off = everyone gets "early". Force an arm with ?ask=early|late.
  askExperiment: PUBLIC_EXP_ASK === "on",
} as const;

/** Tools that set cookies and therefore need the consent bar. PostHog (cookieless) isn't one of them. */
export const hasThirdParty = Boolean(config.ga4Id || config.metaPixelId);
