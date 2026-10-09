// Globals created by third-party snippets (GA4, Meta Pixel, PostHog) and GTM's dataLayer.
interface Window {
  dataLayer: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  posthog?: { init: (...a: unknown[]) => void; capture: (...a: unknown[]) => void; register: (...a: unknown[]) => void };
}
