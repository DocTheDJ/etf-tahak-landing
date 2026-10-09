// Journey tracking: arrival -> engagement -> form -> lead.
//
// Every event goes to three places:
//   1. window.dataLayer: GTM/GA4-compatible, always on, nothing leaves the browser by itself
//   2. /api/track: our own cookieless funnel. The session id lives in memory only,
//      so no consent is needed and the funnel works from the very first ad click.
//   3. GA4 / Meta Pixel / PostHog, only if configured (src/config.ts) AND the visitor consented.
//
// Usage anywhere (Astro <script> or Vue component):
//   import { track } from "@/lib/tracking";
//   track("cta_click", { cta: "sticky" });
//   track("form_view", { loc }, { once: `form_view:${loc}` });
import { config, hasThirdParty } from "@/config";

type Props = Record<string, unknown>;
interface QueuedEvent { n: string; p: Props; t: number }

export interface Context {
  v: string;          // page variant: "fees" | "twins"
  ask: string;        // experiment arm
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  click: string;      // "meta" | "google" | ""
  ref: string;        // referrer host
  vw: number;         // viewport width
}

const isBrowser = typeof window !== "undefined";
const t0 = Date.now();
const sid = Math.random().toString(36).slice(2, 10) + t0.toString(36);
const fired = new Set<string>();
const queue: QueuedEvent[] = [];
let consent: string | null = null;
let ctx: Context | null = null;

function context(): Context {
  if (ctx) return ctx;
  const q = new URLSearchParams(location.search);
  const html = document.documentElement;
  ctx = {
    v: html.dataset.variant ?? "",
    ask: html.dataset.ask ?? "",
    utm_source: q.get("utm_source") ?? "",
    utm_medium: q.get("utm_medium") ?? "",
    utm_campaign: q.get("utm_campaign") ?? "",
    utm_content: q.get("utm_content") ?? "",
    utm_term: q.get("utm_term") ?? "",
    click: q.get("fbclid") ? "meta" : q.get("gclid") ? "google" : "",
    ref: document.referrer ? new URL(document.referrer).hostname : "",
    vw: window.innerWidth,
  };
  return ctx;
}

/** Seconds since landing, for the event log and time-to-lead. */
export function elapsed(): number {
  return Math.round((Date.now() - t0) / 100) / 10;
}

/** What the lead API needs to attribute a lead to its ad and its journey. */
export function session() {
  return { sid, ctx: context(), t: elapsed() };
}

export function track(name: string, props: Props = {}, opts: { once?: string } = {}): void {
  if (!isBrowser) return;
  if (opts.once) {
    if (fired.has(opts.once)) return;
    fired.add(opts.once);
  }
  const t = elapsed();
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, t, ...context(), ...props });
  queue.push({ n: name, p: props, t });
  toThirdParty(name, props);
  if (name === "lead_submitted") flush(); // don't wait for the interval
}

function flush(useBeacon = false): void {
  if (!queue.length) return;
  const body = JSON.stringify({ sid, ctx: context(), events: queue.splice(0) });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------- third parties (consent-gated)

function toThirdParty(name: string, props: Props): void {
  if (consent !== "all") return;
  window.gtag?.("event", name === "lead_submitted" ? "generate_lead" : name, props);
  if (window.fbq) {
    if (name === "lead_submitted") window.fbq("track", "Lead", { content_name: "etf_tahak", content_category: context().v });
    else if (["form_start", "calc_interact", "table_filter"].includes(name)) window.fbq("trackCustom", name, props);
  }
  window.posthog?.capture(name, props);
}

function loadScript(src: string): void {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function loadThirdParty(): void {
  if (config.ga4Id) {
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", config.ga4Id);
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`);
  }
  if (config.metaPixelId) {
    const fbq: any = function (...args: unknown[]) { fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args); };
    fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0"; fbq.queue = [];
    window.fbq = fbq;
    loadScript("https://connect.facebook.net/en_US/fbevents.js");
    window.fbq!("init", config.metaPixelId);
    window.fbq!("track", "PageView");
  }
  if (config.posthogKey) {
    // Official PostHog snippet (array.js loader with a stub queue), unchanged.
    // prettier-ignore
    // @ts-ignore
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    window.posthog!.init(config.posthogKey, { api_host: config.posthogHost, person_profiles: "identified_only" });
    window.posthog!.register(context());
  }
}

export function getConsent(): string | null {
  return consent;
}

export function setConsent(choice: "all" | "none"): void {
  consent = choice;
  try { localStorage.setItem("consent", choice); } catch {}
  track("consent", { choice });
  if (choice === "all") loadThirdParty();
}

// ---------------------------------------------------------------- automatic events (called once from Layout)

let started = false;
export function initTracking(): void {
  if (!isBrowser || started) return;
  started = true;

  try { consent = localStorage.getItem("consent"); } catch {}
  if (hasThirdParty && consent === "all") loadThirdParty();

  let returning = 0;
  try { returning = localStorage.getItem("lead") ? 1 : 0; } catch {}
  track("lp_view", { path: location.pathname, returning });
  setTimeout(() => track("engaged_10s", {}, { once: "engaged" }), 10_000);

  // scroll depth
  let maxScroll = 0;
  addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    const p = h > 0 ? Math.round((scrollY / h) * 100) : 100;
    maxScroll = Math.max(maxScroll, p);
    for (const m of [25, 50, 75, 100]) if (p >= m) track("scroll", { depth: m }, { once: `scroll${m}` });
  }, { passive: true });

  // each section seen once: <section data-sec="name">
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const s = (e.target as HTMLElement).dataset.sec;
      track("section_view", { section: s }, { once: `sec:${s}` });
      io.unobserve(e.target);
    }
  }, { threshold: 0.35 });
  document.querySelectorAll("[data-sec]").forEach((el) => io.observe(el));

  // links/buttons marked <a data-cta="name">
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest?.("[data-cta]") as HTMLElement | null;
    if (a) track("cta_click", { cta: a.dataset.cta });
  });

  // batching + exit
  setInterval(flush, 4000);
  let exited = false;
  const exit = () => {
    if (!exited) {
      exited = true;
      track("page_exit", { max_scroll: maxScroll, time_s: Math.round((Date.now() - t0) / 1000) });
    }
    flush(true);
  };
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") exit(); });
  addEventListener("pagehide", exit);
}
