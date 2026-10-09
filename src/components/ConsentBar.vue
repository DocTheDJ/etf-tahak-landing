<script setup lang="ts">
// Cookie consent for third-party measurement (GA4 / Meta / PostHog). Only rendered when one of them is configured.
// Our own funnel tracking is cookieless and doesn't need it.
import { onMounted, ref } from "vue";
import { getConsent, setConsent } from "@/lib/tracking";

const open = ref(false);
onMounted(() => (open.value = !getConsent()));

function choose(choice: "all" | "none") {
  setConsent(choice);
  open.value = false;
}
</script>

<template>
  <div v-if="open" class="consent" role="region" aria-label="Cookies">
    <p>Pro měření reklam používáme cookies Googlu a Mety. <a href="/ochrana-udaju">Víc</a></p>
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
  background: var(--paper-2); border: var(--line); border-radius: var(--r); box-shadow: var(--shadow);
  padding: 12px 14px; font-size: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
}
p { margin: 0; flex: 1 1 200px; }
div { display: flex; gap: 8px; }
button { min-height: 40px; padding: 0 12px; border: var(--line); border-radius: var(--r); font: 700 14px/1 var(--f-sans); cursor: pointer; background: var(--paper-2); color: var(--ink); }
.yes { background: var(--ink); color: var(--marker); }
</style>
