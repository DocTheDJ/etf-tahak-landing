// Journey tracking: arrival -> engagement -> form -> lead.
//
// Every event goes to three places:
//   1. window.dataLayer: GTM/GA4-compatible, always on, nothing leaves the browser by itself
//   2. /api/track: our own cookieless funnel counter. The session id lives in memory only,
//      so no consent is needed and the funnel works from the very first ad click.
//   3. GA4 / Meta Pixel / PostHog, only if configured in config.js AND the visitor consented.
//
// Usage: track("cta_click", { cta: "sticky" })  ·  track("form_view", { loc }, { once: "form_view:" + loc })
(function () {
  var C = window.ETF_CONFIG || {};
  var d = document.documentElement;
  var q = new URLSearchParams(location.search);
  var t0 = Date.now();
  var sid = Math.random().toString(36).slice(2, 10) + t0.toString(36);
  var once = {};
  var queue = [];
  var maxScroll = 0;

  var ctx = {
    v: d.dataset.v,
    ask: d.dataset.ask,
    utm_source: q.get("utm_source") || "",
    utm_medium: q.get("utm_medium") || "",
    utm_campaign: q.get("utm_campaign") || "",
    utm_content: q.get("utm_content") || "",
    utm_term: q.get("utm_term") || "",
    click: q.get("fbclid") ? "meta" : q.get("gclid") ? "google" : "",
    ref: document.referrer ? new URL(document.referrer).hostname : "",
    vw: window.innerWidth,
  };

  window.dataLayer = window.dataLayer || [];

  // ---------- third parties (consent-gated) ----------
  var hasThirdParty = !!(C.ga4Id || C.metaPixelId || C.posthogKey);
  var consent = null;
  try { consent = localStorage.getItem("consent"); } catch (e) {}

  function loadScript(src) { var s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); }

  function loadThirdParty() {
    if (C.ga4Id) {
      window.gtag = function () { dataLayer.push(arguments); };
      gtag("js", new Date());
      gtag("config", C.ga4Id, { send_page_view: true });
      loadScript("https://www.googletagmanager.com/gtag/js?id=" + C.ga4Id);
    }
    if (C.metaPixelId) {
      /* Meta Pixel base code */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", C.metaPixelId);
      fbq("track", "PageView");
    }
    if (C.posthogKey) {
      /* PostHog snippet (array.js loader) */
      !function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; } (p = t.createElement("script")).type = "text/javascript", p.async = !0, p.src = s.api_host + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e; }, u.people.toString = function () { return u.toString(1) + ".people (stub)"; }, o = "capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group".split(" "), n = 0; n < o.length; n++) g(u, o[n]); e._i.push([i, s, a]); }, e.__SV = 1); }(document, window.posthog || []);
      posthog.init(C.posthogKey, { api_host: C.posthogHost, person_profiles: "identified_only" });
      posthog.register(ctx);
    }
  }

  function to3p(name, props) {
    if (consent !== "all") return;
    if (window.gtag) gtag("event", name === "lead_submitted" ? "generate_lead" : name, props);
    if (window.fbq) {
      if (name === "lead_submitted") fbq("track", "Lead", { content_name: "etf_tahak", content_category: ctx.v });
      else if (name === "form_start" || name === "calc_interact" || name === "table_filter") fbq("trackCustom", name, props);
    }
    if (window.posthog && posthog.capture) posthog.capture(name, props);
  }

  function showConsent() {
    var bar = document.createElement("div");
    bar.className = "consent";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Cookies");
    bar.innerHTML =
      '<p>Pro měření reklam používáme cookies Googlu a Mety. <a href="/ochrana-udaju">Víc</a></p>' +
      '<div><button type="button" data-c="all">Souhlasím</button><button type="button" data-c="none">Jen nezbytné</button></div>';
    bar.addEventListener("click", function (e) {
      var c = e.target.getAttribute("data-c");
      if (!c) return;
      consent = c;
      try { localStorage.setItem("consent", c); } catch (err) {}
      bar.remove();
      document.body.classList.remove("has-consent-bar");
      track("consent", { choice: c });
      if (c === "all") loadThirdParty();
    });
    document.body.appendChild(bar);
    document.body.classList.add("has-consent-bar");
  }

  if (hasThirdParty) {
    if (consent === "all") loadThirdParty();
    else if (!consent) document.addEventListener("DOMContentLoaded", showConsent);
  }

  // ---------- core ----------
  function flush(useBeacon) {
    if (!queue.length) return;
    var body = JSON.stringify({ sid: sid, ctx: ctx, events: queue.splice(0) });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
    }
  }
  setInterval(flush, 4000);
  addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { exitEvent(); flush(true); } });
  addEventListener("pagehide", function () { exitEvent(); flush(true); });

  function track(name, props, opts) {
    props = props || {};
    var key = opts && opts.once;
    if (key) { if (once[key]) return; once[key] = 1; }
    var t = Math.round((Date.now() - t0) / 100) / 10; // seconds since landing
    window.dataLayer.push(Object.assign({ event: name, t: t }, ctx, props));
    queue.push({ n: name, p: props, t: t });
    to3p(name, props);
    if (name === "lead_submitted") flush(); // don't wait for the interval
  }

  var exited = false;
  function exitEvent() {
    if (exited) return;
    exited = true;
    track("page_exit", { max_scroll: maxScroll, time_s: Math.round((Date.now() - t0) / 1000) });
  }

  // ---------- automatic events ----------
  track("lp_view", { path: location.pathname, returning: (function () { try { return localStorage.getItem("lead") ? 1 : 0; } catch (e) { return 0; } })() });
  setTimeout(function () { track("engaged_10s", {}, { once: "engaged" }); }, 10000);

  var marks = [25, 50, 75, 100];
  addEventListener("scroll", function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    var pct = h > 0 ? Math.round((scrollY / h) * 100) : 100;
    if (pct > maxScroll) maxScroll = pct;
    marks.forEach(function (m) { if (pct >= m) track("scroll", { depth: m }, { once: "scroll" + m }); });
  }, { passive: true });

  document.addEventListener("DOMContentLoaded", function () {
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var s = e.target.getAttribute("data-sec");
        track("section_view", { section: s }, { once: "sec:" + s });
        io.unobserve(e.target);
      });
    }, { threshold: 0.35 });
    document.querySelectorAll("[data-sec]").forEach(function (el) {
      if (el.offsetParent !== null) io.observe(el); // skip the hidden hero of the other variant
    });
  });

  // CTA clicks anywhere: <a data-cta="name">
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-cta]");
    if (a) track("cta_click", { cta: a.getAttribute("data-cta") });
  });

  window.track = track;
  window.trackSession = function () { return { sid: sid, ctx: ctx, t: (Date.now() - t0) / 1000 }; };
})();
