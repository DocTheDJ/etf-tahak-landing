# How I work with AI

Working with AI is rather simple once you know what you want from the result: you describe what you want, and it can figure out the rest.

That being said, it does have a few shortcomings, like not always knowing which technology is best for the situation, so it must be guided through this, or you have it give you options and choose from them. I do that quite often, but I do my own research. Using AI without knowing what the output does can be very dangerous and very expensive. On the other hand, if you know what it makes and what it should make, it can be a priceless tool.

## My usage in this particular case

The exact prompts are in the logs ([`ai-log/`](../ai-log)).

I started off by giving the agent a translated version of the assignment. I myself am not very well versed in the sector this task targets, so I gave it word for word and added some specifics, like the target deployment and that this time it is meant to be on GitHub. Before it started building, I asked to see the plan first, and that plan is now part of the result ([`docs/PLAN.md`](PLAN.md)).

From there the agent took off by itself and ran rather cleanly. Since it did not have any specific style in mind, it could do whatever it liked, and I would just guide it through the specifics I didn't like.

After the first version I went to look at the code and found that it was written correctly, but since I did not specify the technology, it chose plain JS (it was in the plan, and I didn't catch it). I did not want that, because I have a problem navigating it, since it can be quite verbose. So I asked for options, had it compare Astro + Vue against Nuxt, and had it refactor to Astro with Vue and TypeScript. Astro I heard about in another session with Claude; Vue I know well.

The original design was pretty strong and somewhat aimed at the learning experience, and it all worked. However, the design had to change to a more modern style that I thought would bring more of the feeling of being in the action itself, as if the visitor is already on the platform where they get what they want. So the agent was tasked with making options for different, darker designs, since a young person who wants to get into ETFs often starts on YouTube, and most of the platforms look the same. The agent presented me with options and I chose the one I liked the most.

After that it was mainly testing and fine-tuning details, like the glow around the input and the buttons. That was not there, but I thought it would attract attention, so I had Claude add it.

I had the agent set up the Vercel hosting. It just needed access to the project so that it could deploy automatically.

Then I had it add PostHog to track the usage of the page. I have never used it and had never thought about tracking page usage, so this is completely new to me, but it would seem that the AI had it under control. I would normally just use Sentry to track crashes, but that is not needed here.

When I came back to it after some time, I saw that there were a lot of hand-written styles, so I had Claude switch to Tailwind (and Pinia for the shared state) so that it is more readable, while keeping the visuals and behaviour the same.

## How I checked the output

- **Reading the code.** That is how I found that the first version was plain JS and hard to follow, and later that the styles were hard to read.
- **Using the page on my phone.** That is where I found that a large result in the calculator pushed "Kč" onto a second line.
- **Asking questions instead of accepting the first answer.** For example, whether there is GDPR consent for the emails, and whether Nuxt would be a better fit than Astro.
- **Tests.** I had the agent write unit tests and end-to-end tests (a phone-sized browser going through the whole journey on both ad variants). They run in CI on every push, and they caught several of the bugs below.
- **Checking the live site,** not just the local one, after every deploy.

## Where the AI got it wrong

- **Technology choice.** Without a stack specified, it went with plain HTML/CSS/JS in a single 400-line `app.js`. It works and it's fast, but it's hard to read and maintain. I had it rebuilt in Astro + Vue + TypeScript.
- **An imprecise comparison.** When comparing Astro and Nuxt, it said that with Nuxt "the first screen shows up later". When I asked about it, it corrected itself: with server rendering, Nuxt shows the first screen just as fast. The real difference is how much JavaScript the phone has to run afterwards.
- **Out-of-date knowledge.** Its numbers from memory would have been wrong: VWCE's fee fell to 0.14 % in July 2026, SPLG was renamed to SPYM, and VTI now tracks a Morningstar index. That is why all the data is fetched live by a script, with the source next to every number.
- **Missing GDPR consent.** The first version planned 4 follow-up emails with no separate consent, calling them "part of the cheat sheet". It only flagged this as a problem after I asked. Now there is a separate opt-in after the download, and the exact wording the visitor saw is stored with the lead.
- **The calculator layout on the phone.** For the largest possible result (−9 384 000 Kč), "Kč" wrapped onto a second line. I found it on my phone; now the font shrinks to fit, and a test checks it at five screen widths.
- **Email typo correction.** `jana@gmail.cz` was being "corrected" to `email.cz` instead of `gmail.com`. A unit test caught it.
- **Vue hydration bugs.** Signing up before the table below had loaded caused mismatches between the server-rendered and the client-rendered page. The e2e test checks for these warnings, so it was caught and fixed.
- **Broken production deploy.** After the move to Astro, the sign-up form worked locally but every API route crashed on Vercel. The Vercel adapter released the day before (`@astrojs/vercel` 11.0.13) bundled build-only tools into the server function. That was not the agent's code, but it was only caught by checking the live site. The version is now pinned to 11.0.12, and a build check fails if this happens again.
