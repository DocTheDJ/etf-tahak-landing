<script setup lang="ts">
// Cookie consent for the cookie-based tools (GA4 / Meta Pixel). Only rendered when one of them is configured.
// Our own funnel and PostHog run cookieless and don't need it; accepting also allows PostHog session replay
// (from the next page load).
import { onMounted, ref } from "vue";
import { getConsent, setConsent } from "@/lib/tracking";
import { config } from "@/config";

const tools = [config.ga4Id && "Googlu", config.metaPixelId && "Mety"].filter(Boolean).join(" a ");
const replay = Boolean(config.posthogKey);

const open = ref(false);
onMounted(() => (open.value = !getConsent()));

function choose(choice: "all" | "none") {
  setConsent(choice);
  open.value = false;
}
</script>

<template>
  <div v-if="open" class="consent" role="region" aria-label="Cookies">
    <p>Pro měření reklam používáme cookies {{ tools }}<template v-if="replay"> a anonymní záznam návštěvy</template>. <a href="/ochrana-udaju">Víc</a></p>
    <div>
      <button type="button" class="yes" @click="choose('all')">Souhlasím</button>
      <button type="button" @click="choose('none')">Jen nezbytné</button>
    </div>
  </div>
</template>

<style scoped>
.consent {
  position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 30;
  max-width: calc(var(--col) - 24px); margin: 0 auto;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  padding: 12px 14px; font-size: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; color: var(--text);
}
p { margin: 0; flex: 1 1 200px; }
a { color: var(--lime); }
div { display: flex; gap: 8px; }
button { min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; font: 700 14px/1 var(--f-sans); cursor: pointer; background: transparent; color: var(--text); }
.yes { background: var(--lime); border-color: var(--lime); color: var(--lime-ink); }
</style>
