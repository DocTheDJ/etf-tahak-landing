<script setup lang="ts">
// The comparison: 12 NYSE ETFs with their European twins. Filter, sort, show 6 then all.
// Twins are blurred until sign-up (except the 3 shown in the hero/ad); a locked twin is a CTA to the form.
import { computed, onBeforeUnmount, onMounted, onUpdated, ref } from "vue";
import { storeToRefs } from "pinia";
import type { Category, Etf, TwinMatch } from "@/data/etfs";
import { pct } from "@/lib/format";
import { track } from "@/lib/tracking";
import { focusLeadForm } from "@/lib/dom";
import { useLeadStore } from "@/stores/lead";
import Chip from "./ui/Chip.vue";
import Btn from "./ui/Btn.vue";

const props = defineProps<{ etfs: Etf[]; freeTwins: string[] }>();

const FILTERS: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "Vše" },
  { id: "sp500", label: "S&P 500" },
  { id: "world", label: "Svět" },
  { id: "dividend", label: "Dividendy" },
  { id: "tech", label: "Tech" },
  { id: "gold", label: "Zlato" },
];
const SORTS = [
  { id: "pop", label: "oblíbenost" },
  { id: "er", label: "poplatek" },
  { id: "r10", label: "výnos 10 let" },
] as const;
const MATCH: Record<TwinMatch, string> = { same: "stejný index", close: "téměř stejný koš akcií", similar: "podobná strategie, jiný index" };
const FIRST = 6;

const cat = ref<Category | "all">("all");
const sort = ref<(typeof SORTS)[number]["id"]>("pop");
const expanded = ref(false);

// Unlock state comes from the shared store, applied after mount (the server renders the locked version).
const lead = useLeadStore();
const { leadId, submittedFrom } = storeToRefs(lead);
const mounted = ref(false);

// The 🔒 buttons carry a light sweep (the sheen utility), staggered per row so they don't flash in sync,
// and paused while scrolled out of view so a long list doesn't animate off-screen.
const listEl = ref<HTMLElement | null>(null);
let io: IntersectionObserver | null = null;
function observeUnlocks() {
  if (!io || !listEl.value) return;
  io.disconnect();
  listEl.value.querySelectorAll("[data-unlock]").forEach((b) => io!.observe(b));
}
onMounted(() => {
  if (!("IntersectionObserver" in window)) return;
  io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle("is-paused", !e.isIntersecting);
  });
  observeUnlocks();
});
onUpdated(observeUnlocks); // filter, sort and "show more" re-render the list
onBeforeUnmount(() => io?.disconnect());
const sheenDelay = (i: number) => `${-((i * 0.9) % 2.6).toFixed(1)}s`;
onMounted(() => { lead.restore(); mounted.value = true; });
const unlocked = computed(() => mounted.value && !!leadId.value);
const isOpen = (e: Etf) => unlocked.value || props.freeTwins.includes(e.ticker);
// Highlight the newly revealed twins only when the unlock happens during this visit (not for returning visitors).
const justUnlocked = (e: Etf) => mounted.value && !!submittedFrom.value && !props.freeTwins.includes(e.ticker);

const rows = computed(() => {
  const list = props.etfs.filter((e) => cat.value === "all" || e.cat === cat.value);
  const popularity = (e: Etf) => props.etfs.indexOf(e); // data file order = popularity
  return [...list].sort((a, b) =>
    sort.value === "er" ? a.er - b.er || popularity(a) - popularity(b)
    : sort.value === "r10" ? (b.r10 ?? 0) - (a.r10 ?? 0)
    : popularity(a) - popularity(b),
  );
});
const visible = computed(() => (expanded.value || rows.value.length <= FIRST + 1 ? rows.value : rows.value.slice(0, FIRST)));
const hidden = computed(() => rows.value.length - visible.value.length);

function setCat(id: Category | "all") { cat.value = id; track("table_filter", { cat: id }); }
function setSort(id: (typeof SORTS)[number]["id"]) { sort.value = id; track("table_sort", { by: id }); }
function expand() { expanded.value = true; track("table_expand", { cat: cat.value }); }
function unlock(ticker: string) { track("locked_click", { ticker }); focusLeadForm("final"); }
const tone = (x: number | null) => (x == null ? "" : x >= 0 ? "text-lime" : "text-coral");
</script>

<template>
  <div class="-mx-4 flex gap-1.5 overflow-x-auto px-4 pt-0.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="toolbar" aria-label="Filtr">
    <Chip v-for="f in FILTERS" :key="f.id" font="sans" :on="cat === f.id" @click="setCat(f.id)">{{ f.label }}</Chip>
  </div>
  <div class="mt-1 mb-3 text-[13px] text-muted">
    Řadit:
    <template v-for="(s, i) in SORTS" :key="s.id">
      <span v-if="i" aria-hidden="true"> · </span>
      <button
        type="button"
        class="cursor-pointer px-0.5 py-1"
        :class="sort === s.id ? 'font-bold text-lime no-underline' : 'text-muted underline underline-offset-3'"
        @click="setSort(s.id)"
      >{{ s.label }}</button>
    </template>
  </div>

  <ul ref="listEl" class="grid gap-2.5" aria-live="polite">
    <li v-for="(e, i) in visible" :key="e.ticker" class="overflow-hidden rounded-card border border-line bg-surface px-3.5 pt-3" data-testid="etf-row">
      <div class="flex items-baseline gap-2.5">
        <s class="flex-none font-mono text-[20px] leading-none font-bold text-coral decoration-2" :title="`${e.exchange}, z ČR nekoupíte`">{{ e.ticker }}</s>
        <span class="truncate text-[12.5px] leading-[1.25] text-muted">{{ e.name }}</span>
      </div>
      <div class="mt-2.5 mb-3 grid grid-cols-[repeat(3,1fr)] gap-1.5">
        <div v-for="stat in [
          { label: 'poplatek', value: pct(e.er), tone: '' },
          { label: '10 let ročně', value: pct(e.r10, 1), tone: tone(e.r10) },
          { label: 'poslední rok', value: pct(e.r1, 1), tone: tone(e.r1) },
        ]" :key="stat.label" class="flex flex-col gap-0.5">
          <span class="text-[11px] leading-[1.2] text-muted">{{ stat.label }}</span>
          <b class="font-mono text-[15px] leading-[1.3] font-bold" :class="stat.tone">{{ stat.value }}</b>
        </div>
      </div>

      <div
        class="-mx-3.5 grid min-h-14 items-center gap-x-2.5 border-t border-dashed border-line bg-surface-2 px-3.5 pt-2.5 pb-3"
        :class="[isOpen(e) ? 'grid-cols-[auto_auto_1fr]' : 'grid-cols-[auto_auto_1fr_auto]', justUnlocked(e) && 'animate-unlock']"
        :data-locked="isOpen(e) ? undefined : ''"
      >
        <span class="text-[18px] text-muted" aria-label="Evropské dvojče">→</span>
        <template v-if="isOpen(e)">
          <span class="font-mono text-[19px] leading-[1.1] font-bold text-lime">{{ e.twin.ticker }}</span>
          <span class="min-w-0 font-mono text-[11.5px] leading-[1.45] font-medium text-muted [&_b]:text-fg">
            <b>{{ pct(e.twin.ter) }}</b> · {{ e.twin.dist === "acc" ? "akumulační" : "vyplácí dividendy" }} · {{ MATCH[e.twin.match] }}<br />
            ISIN {{ e.twin.isin }}
          </span>
        </template>
        <template v-else>
          <!-- placeholder text, not the real twin: the data is behind the email -->
          <span class="font-mono text-[19px] leading-[1.1] font-bold text-lime blur-[5px] select-none" aria-hidden="true">XXXX</span>
          <span class="hidden min-w-0 font-mono text-[11.5px] leading-[1.45] font-medium text-muted blur-[5px] select-none min-[400px]:block [&_b]:text-fg" aria-hidden="true">
            <b>0,00 %</b> · xxxxxxxxx<br />ISIN IE000XXXXXXX
          </span>
          <button
            type="button"
            class="sheen inline-flex min-h-10 cursor-pointer items-center gap-1.5 justify-self-end rounded-full bg-lime px-3.5 font-sans text-[13px] leading-none font-extrabold whitespace-nowrap text-ink hover:bg-white"
            :style="{ '--sheen-delay': sheenDelay(i) }"
            data-unlock
            @click="unlock(e.ticker)"
          >
            <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true"><rect x="1" y="5.5" width="10" height="7" rx="1.5" fill="currentColor" /><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" stroke-width="1.6" fill="none" /></svg>
            Odemknout
          </button>
        </template>
      </div>
    </li>
  </ul>
  <Btn v-if="hidden > 0" variant="ghost" block class="mt-3" @click="expand">Ukázat dalších {{ hidden }} ETF ↓</Btn>
</template>
