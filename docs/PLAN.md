# The plan (as agreed before building)

This is the plan that was approved before any code was written. It's kept here so you can compare intent with result. The [README](../README.md) explains the reasoning in full; the last section lists what changed during the build and why.

## The insight
The brief asks to compare NYSE-traded ETFs for Czech retail investors. **A Czech retail investor can't buy most of them.** Under the EU PRIIPs rules, US-domiciled ETFs publish no KID, so EU brokers block them for retail clients. Every Czech beginner who copies a US YouTuber runs into this. So the page compares NYSE ETFs **and** shows each one's European "twin" (an Irish UCITS fund on the same index, e.g. VOO → VUAA) that they *can* buy. It's real, hard-to-find value, and it makes a strong hook.

Working brand: **"ETF tahák"** ("tahák" = Czech for cheat sheet). Made-up brand, not a real company.

## Target group
Czech, 25–40, on mobile, above-average income. Savings sit in a bank account or an expensive bank fund (~1.5–2.5 % a year). Knows "S&P 500" from social media. Doesn't know which ETF to pick, worries about fees and taxes, and some have already been blocked when trying to buy VOO. Distrusts pushy Czech financial advisors. The copy says it outright: "nebudeme vám volat" ("we won't call you").

## What they get for their email
A **PDF "ETF tahák 2026"**: 12 NYSE ETFs (fees, 10-year return, yield) + each one's buyable UCITS twin with ISIN + a one-page Czech tax summary (W-8BEN, 3-year time test, 100k CZK exemption, DIP) + their own calculator result.

## When we ask
**One field: email.** Right after the visitor sees their personal loss number ("na poplatcích ztratíte 412 000 Kč", "you'll lose 412,000 CZK on fees"), when they care most. The same form also sits in the hero (for people who decided from the ad) and under the locked table rows. Sticky bottom button on mobile.

## Two ads and matching first screens
| | Ad A: fees | Ad B: twins |
|---|---|---|
| Hook | "Your bank fund takes 2 %, VOO 0.03 %. See the difference in 10 seconds." | "Wanted to buy VOO and your broker said no? Here are its European twins." |
| First screen | Calculator in the hero → result → email | Cheat-sheet preview + first table rows → email |

`utm_content` decides which hero shows. One page, section order switched by variant, no flicker.

## Page sections (fees variant)
Hero with calculator → what's in the cheat sheet → ETF comparison table (2 twins visible, the rest locked) → 3 objections ("why can't I buy VOO?", "what's the catch?", "will you call me?") → final form → sources.

## After they submit
The table unlocks instantly and the PDF downloads right away (no waiting for email), plus a copy by email. Then one tap-to-answer question for lead quality ("Kolik měsíčně investujete?", "How much do you invest monthly?"), asked only after submit so it costs no conversions, and a WhatsApp share button.

## Data
Prices and returns from the Yahoo Finance API through a re-runnable script; NYSE Arca listing verified; current expense ratios; twins checked on justETF; average fund costs from ESMA.

## Tracking
Every step: arrival (UTM, variant) → scroll depth → each section seen → calculator use → table filters → clicks on locked rows → every CTA → form start → form errors → submit → PDF download → follow-up answer → time to sign-up. Own cookieless tracking from the first click; GA4 / Meta Pixel (`Lead`) / PostHog ready to switch on by adding IDs, loaded only after consent. Leads go to a Vercel function → Upstash Redis and/or a webhook; email via Resend. Each switched on with an environment variable.

## Tech and design
Plain HTML/CSS/JS, no framework (fast on mobile). Look: "paper cheat sheet" (squared paper, ink, yellow highlighter, monospace ticker numbers, a few handwritten notes). Deliberately not the default gradient-and-cards style. Ads as HTML rendered to PNG (4:5 feed + 9:16 story); the PDF made the same way.

## README
Target group, offer, ask moment, ads, section order, expected conversion rate (~8–12 % on cold mobile Meta traffic, with funnel math and CPL), 3 A/B tests ranked (offer framing > ask timing > "no calls" wording), tracking plan, launch checklist.

---

## What changed during the build, and why

| Planned | Built | Why |
|---|---|---|
| 12 ETFs incl. AGG (bonds) | AGG dropped, **SPYM** added | Bonds are off-target for this audience. SPYM is the cheapest S&P 500 ETF (0.02 %), and "which S&P 500 ETF?" is the #1 question. Four S&P 500 funds side by side answer it. |
| "2 twins visible" | **3 visible** (VOO, SPY, VT) | Same three as in the hero and in Ad B, so the promise is kept consistently. |
| Full table | **6 cards + "show 6 more"**, sorted by popularity | 12 full cards made ~3,000 px of scrolling on a phone, too long for a few-second visitor. |
| Calculator compares fund vs VOO (0.03 %) | Compares vs **VUAA (0.07 %)**, the twin | VOO is exactly what they *can't* buy; comparing against it would be misleading. |
| Fee average "1.5–2.5 %" | **1.9 %** (ESMA 2025 report, p. 6) | One cited number beats a range. It's the EU average total cost of non-ETF equity funds. |
| Ask timing as an idea | Implemented as a switchable **A/B experiment** (`ask=early|late`) | H2 in the README can be run without new code. |
| (not planned) | Email typo fix ("seznam.cz?") | Seznam is the #1 Czech email provider; a typo means a lost lead after we already paid for it. |
| (not planned) | Returning visitors see "Tahák už máte ✓" instead of the form | Don't ask twice; don't double-count leads. |
| (not planned) | Funnel dashboard `/api/stats` | So "track the whole journey" is readable without GA. |
| (not planned) | Weekly GitHub Action refreshing the data | Fees and returns change; "data k …" must stay true. |

## Second iteration: rebuilt on Astro + Vue

After review, the plain HTML/JS version was hard to navigate (one 400-line `app.js`, HTML built from strings, variants switched with CSS ordering). It was rebuilt on **Astro + Vue + TypeScript**, keeping the design, copy, data, tracking events and strategy unchanged:

| Before (vanilla) | After (Astro + Vue) |
|---|---|
| One page, variant picked by an inline script from `utm_content` | Two pre-rendered pages: `/` (ad A) and `/dvojcata` (ad B), each a readable list of sections |
| `app.js` with `querySelector` + string templates | Vue single-file components: `Calculator`, `EtfTable`, `LeadForm`, `ThankYou`, `StickyCta`, `ConsentBar` |
| Global flags in `localStorage` read by every script | nanostores shared between islands (`src/stores/`) |
| `config.js` edited by hand | Typed env schema (`astro:env`): launch settings are Vercel env vars, no code edits |
| Raw Vercel functions in `api/` + a hand-written dev server | Astro API routes in `src/pages/api/`, `astro dev` |
| Ad-hoc test script | Vitest unit tests + Playwright e2e in the repo, run in CI |

Found and fixed along the way: the typo suggester turned `gmail.cz` into `email.cz` (now fixes the ending of a known provider first), and a Vue hydration mismatch when a visitor signed up before the table below had loaded.

## Third iteration: design direction "Burza naživo"

Four directions were explored as interactive phone mockups (live trading terminal, pop-art comic, banknote, chat). Chosen: **A · Burza naživo**, because it makes the visitor feel they're already where they want to be: inside a trading app, looking at live markets. The paper cheat-sheet look was replaced across the page, the ads, the OG image, the email and the PDF (the PDF stays white for printing, with the same fonts and accents).

| | Before ("tahák" paper) | After ("Burza naživo") |
|---|---|---|
| Ground | Squared cream paper | Near-black `#0E0F12` |
| Accents | Highlighter yellow, red pen, green | Lime `#D4FF3A` = buyable / action, coral `#FF5A4E` = loss / blocked |
| Type | Archivo + Caveat handwriting | Bricolage Grotesque + JetBrains Mono for every number |
| Motion | Almost none | Scrolling ticker tape of the real pairs (sticky), pulsing live-data dot, blinking cursor on the loss, bars and the loss number re-animate on every tap, order-book rows slide in, the cheaper twin flashes |

All motion is CSS and stops for visitors with "reduce motion" enabled.

## Fourth iteration: email effects and GDPR consent

- Email field: a running lime border until the address is valid, then solid lime + ✓. Buttons (submit when valid, 🔒 Odemknout): a light sweep, staggered and paused off-screen. Chosen from three interactive variants on the design canvas.
- The 4 tips emails were described as "part of the cheat sheet" without consent, a grey zone under Czech Act 480/2004 §7. They're now a separate, explicit opt-in on the thank-you panel ("Ano, chci tipy" / "Ne, stačí mi PDF"). The consent is stored with timestamp, versioned wording and the exact text (`src/lib/consent.ts`). The PDF still needs only the email.
