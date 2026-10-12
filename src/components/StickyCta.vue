<script setup lang="ts">
// Bottom bar on mobile: appears after the first screen, hides whenever a lead form is on screen
// (no point pointing at a form the visitor can already see), and disappears for good after sign-up.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { track } from "@/lib/tracking";
import { focusLeadForm } from "@/lib/dom";
import { useLeadStore } from "@/stores/lead";

const lead = useLeadStore();
const { leadId } = storeToRefs(lead);
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
  lead.restore();
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
  <button
    type="button"
    data-testid="sticky-cta"
    class="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-20 mx-auto flex min-h-14 max-w-[calc(var(--container-col)-24px)] cursor-pointer appearance-none items-center justify-between gap-2.5 rounded-ctl border-0 bg-lime px-[18px] font-sans text-[16px] leading-none font-bold text-ink shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-transform duration-250 ease-[ease]"
    :class="show ? 'translate-y-0' : 'translate-y-[140%]'"
    :aria-hidden="!show"
    :tabindex="show ? 0 : -1"
    @click="go"
  >
    <span>Tahák s 12 dvojčaty</span><b class="font-extrabold">Chci ho →</b>
  </button>
</template>
