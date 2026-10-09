// @ts-check
import { defineConfig, envField } from "astro/config";
import vue from "@astrojs/vue";
import vercel from "@astrojs/vercel";

const optional = { optional: true, default: "" };

// Pages are static HTML (prerendered at build time).
// Only src/pages/api/* opt out with `export const prerender = false` and run as Vercel functions.
export default defineConfig({
  site: "https://etf-tahak-landing.vercel.app",
  integrations: [vue()],
  adapter: vercel(),

  // Every environment variable the project uses, in one place. All optional: the site works without them.
  // Set them in Vercel → Settings → Environment Variables (see .env.example).
  env: {
    schema: {
      // --- public: inlined into the browser bundle at build time (redeploy after changing)
      PUBLIC_GA4_ID: envField.string({ context: "client", access: "public", ...optional }),
      PUBLIC_META_PIXEL_ID: envField.string({ context: "client", access: "public", ...optional }),
      PUBLIC_POSTHOG_KEY: envField.string({ context: "client", access: "public", ...optional }),
      PUBLIC_POSTHOG_HOST: envField.string({ context: "client", access: "public", optional: true, default: "https://eu.i.posthog.com" }),
      PUBLIC_OPERATOR: envField.string({ context: "client", access: "public", ...optional }),
      PUBLIC_EXP_ASK: envField.enum({ values: ["on", "off"], context: "client", access: "public", optional: true, default: "off" }),

      // --- secret: read at runtime by the API routes only
      UPSTASH_REDIS_REST_URL: envField.string({ context: "server", access: "secret", optional: true }),
      UPSTASH_REDIS_REST_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      KV_REST_API_URL: envField.string({ context: "server", access: "secret", optional: true }), // name used by Vercel's Upstash integration
      KV_REST_API_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      LEAD_WEBHOOK_URL: envField.string({ context: "server", access: "secret", optional: true }),
      RESEND_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      MAIL_FROM: envField.string({ context: "server", access: "secret", optional: true }),
      SITE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      STATS_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
