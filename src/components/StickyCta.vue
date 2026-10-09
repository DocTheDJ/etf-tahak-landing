<script setup lang="ts">
// Bottom bar on mobile: appears after the first screen, hides whenever a lead form is on screen
// (no point pointing at a form the visitor can already see), and disappears for good after sign-up.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useStore } from "@nanostores/vue";
import { track } from "@/lib/tracking";
import { focusLeadForm } from "@/lib/dom";
import { $leadId } from "@/stores/lead";

const leadId = useStore($leadId);
const pastFold = ref(false);
const formsInView = ref(0);
const show = computed(() => pastFold.value && formsInView.value === 0 && !leadId.value);

let io: IntersectionObserver | null = null;
const inView = new Set<Element>();
const onScroll = () => {
  pastFold.value = scrollY > innerHeight * 0.9;
  if (show.value) track("sticky_shown", {}, { once: "sticky" });
};

onMounted(() => {
  addEventListener("scroll", onScroll, { passive: true });
  io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? inView.add(e.target) : inView.delete(e.target);
    formsInView.value = inView.size;
  }, { threshold: 0.25 });
  // Lead forms hydrate on their own schedule; observe the ones present now and any added later.
  const observeAll = () => document.querySelectorAll("form[data-loc]").forEach((f) => io!.observe(f));
  observeAll();
  setTimeout(observeAll, 1500);
});
onBeforeUnmount(() => { removeEventListener("scroll", onScroll); io?.disconnect(); });

function go() {
  track("cta_click", { cta: "sticky" });
  focusLeadForm("final");
}
</script>

<template>
  <button type="button" class="sticky" :class="{ shown: show }" :aria-hidden="!show" :tabindex="show ? 0 : -1" @click="go">
    <span>Tahák s 12 dvojčaty</span><b>Zdarma →</b>
  </button>
</template>

<style scoped>
.sticky {
  -webkit-appearance: none; appearance: none; cursor: pointer;
  position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 20;
  max-width: calc(var(--col) - 24px); margin: 0 auto;
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  min-height: 56px; padding: 0 16px; border: var(--line); border-radius: var(--r);
  background: var(--ink); color: #fff; box-shadow: 3px 3px 0 var(--marker);
  font: 600 16px/1 var(--f-sans);
  transform: translateY(140%); transition: transform 0.25s ease;
}
.sticky b { color: var(--marker); font-weight: 800; }
.shown { transform: none; }
</style>
