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
