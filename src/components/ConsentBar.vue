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
  <div
    v-if="open"
    class="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-[calc(var(--container-col)-24px)] flex-wrap items-center gap-x-3 gap-y-2 rounded-ctl border border-line bg-surface px-3.5 py-3 text-[14px] text-fg shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
    role="region"
    aria-label="Cookies"
  >
    <p class="flex-[1_1_200px] [&_a]:text-lime">Pro měření reklam používáme cookies {{ tools }}<template v-if="replay"> a anonymní záznam návštěvy</template>. <a href="/ochrana-udaju">Víc</a></p>
    <div class="flex gap-2">
      <button type="button" class="min-h-11 cursor-pointer rounded-[10px] border border-lime bg-lime px-3 font-sans text-[14px] leading-none font-bold text-ink" @click="choose('all')">Souhlasím</button>
      <button type="button" class="min-h-11 cursor-pointer rounded-[10px] border border-line bg-transparent px-3 font-sans text-[14px] leading-none font-bold text-fg" @click="choose('none')">Jen nezbytné</button>
    </div>
  </div>
</template>
