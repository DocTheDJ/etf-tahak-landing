// PostHog product analytics: funnels, breakdowns by ad, web analytics dashboard.
//
// - EU Cloud, COOKIELESS mode: nothing is written to cookies or local/session storage. PostHog counts visitors with
//   a server-side hash (project, daily-rotating salt, IP, user agent, hostname), so it runs from the very first ad
//   click without a consent banner. Requires "Cookieless server hash mode" ON in the PostHog project settings.
// - Goes through our own domain (/rq7 → eu.i.posthog.com, see vercel.json + astro.config.mjs) so ad blockers that
//   block posthog.com don't drop the events.
// - Loaded lazily after the page is interactive: the first screen never waits for analytics. Events fired before
//   that are queued and sent with their original timestamps.
// - Session replay only for visitors who accepted cookies in the consent bar (from their next page load on).
// - No autocapture and no identify(): we send our explicit funnel events, and emails never go to analytics.
// - Uses PostHog's slim build (core capture only, ~52 KB gz instead of ~106 KB). It's marked experimental by PostHog;
//   tests/e2e/posthog.spec.ts covers what we rely on. The replay extension is loaded only for consenting visitors.
import type { PostHogInterface } from "posthog-js/dist/module.slim";
import { config } from "@/config";

type Props = Record<string, unknown>;

let instance: PostHogInterface | null = null;
let started = false;
const pending: { name: string; props: Props; at: Date }[] = [];

export const posthogEnabled = Boolean(config.posthogKey);

/**
 * @param superProps sent with every event (page variant, UTM parameters, A/B arm…)
 * @param consented  the visitor accepted cookies earlier: allow persistence + session replay
 */
export function startPosthog(superProps: Props, consented: boolean): void {
  if (!posthogEnabled || started) return;
  started = true;

  const load = async () => {
    const [{ default: posthog }, extensions] = await Promise.all([
      import("posthog-js/dist/module.slim"),
      consented ? import("posthog-js/dist/extension-bundles") : Promise.resolve(null),
    ]);
    posthog.init(config.posthogKey, {
      __extensionClasses: extensions ? { ...extensions.SessionReplayExtensions } : {},
      advanced_disable_flags: true, // no feature flags used (A/B arms are assigned before paint, see Layout)
      api_host: config.posthogProxy,
      ui_host: config.posthogUiHost,
      defaults: "2026-08-30",
      ...(consented ? {} : { cookieless_mode: "always" as const }),
      person_profiles: "identified_only",
      autocapture: false,
      capture_pageview: false, // sent below, after the super properties are registered
      disable_session_recording: !consented,
      disable_surveys: true,
      disable_compression: import.meta.env.DEV, // readable payloads in dev and tests
      debug: import.meta.env.DEV && location.search.includes("phdebug"), // dev only: ?phdebug logs every PostHog step
      // PostHog drops events from automated browsers (bot filter). Keep that in production; in dev let them through
      // so the e2e tests (Playwright = navigator.webdriver) can see what would be sent.
      opt_out_useragent_filter: import.meta.env.DEV,
      loaded: (ph) => {
        ph.register(superProps);
        ph.capture("$pageview");
        for (const e of pending.splice(0)) ph.capture(e.name, e.props, { timestamp: e.at });
        instance = ph;
      },
    });
  };

  const run = () => { load().catch(() => { /* analytics must never break the page */ }); };
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 3000 });
  else setTimeout(run, 1500);
}

export function capturePosthog(name: string, props: Props): void {
  if (!posthogEnabled) return;
  if (instance) instance.capture(name, props);
  else pending.push({ name, props, at: new Date() });
}
