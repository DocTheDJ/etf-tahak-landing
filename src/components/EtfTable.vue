<script setup lang="ts">
// The comparison: 12 NYSE ETFs with their European twins. Filter, sort, show 6 then all.
// Twins are blurred until sign-up (except the 3 shown in the hero/ad); a locked twin is a CTA to the form.
import { computed, onBeforeUnmount, onMounted, onUpdated, ref } from "vue";
import { useStore } from "@nanostores/vue";
import type { Category, Etf, TwinMatch } from "@/data/etfs";
import { pct } from "@/lib/format";
import { track } from "@/lib/tracking";
import { focusLeadForm } from "@/lib/dom";
import { $leadId, $submittedFrom } from "@/stores/lead";

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
const leadId = useStore($leadId);
const mounted = ref(false);

// The 🔒 buttons carry a light sweep (global .sheen), staggered per row so they don't flash in sync,
// and paused while scrolled out of view so a long list doesn't animate off-screen.
const listEl = ref<HTMLElement | null>(null);
let io: IntersectionObserver | null = null;
function observeUnlocks() {
  if (!io || !listEl.value) return;
  io.disconnect();
  listEl.value.querySelectorAll(".unlock").forEach((b) => io!.observe(b));
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
onMounted(() => (mounted.value = true));
const unlocked = computed(() => mounted.value && !!leadId.value);
const isOpen = (e: Etf) => unlocked.value || props.freeTwins.includes(e.ticker);
// Highlight the newly revealed twins only when the unlock happens during this visit (not for returning visitors).
const submittedFrom = useStore($submittedFrom);
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
const tone = (x: number | null) => (x == null ? "" : x >= 0 ? "pos" : "neg");
</script>

<template>
  <div class="filters" role="toolbar" aria-label="Filtr">
    <button v-for="f in FILTERS" :key="f.id" type="button" class="chip" :class="{ 'is-on': cat === f.id }" @click="setCat(f.id)">{{ f.label }}</button>
  </div>
  <div class="sort">
    Řadit:
    <template v-for="(s, i) in SORTS" :key="s.id">
      <span v-if="i" aria-hidden="true"> · </span>
      <button type="button" class="link" :class="{ 'is-on': sort === s.id }" @click="setSort(s.id)">{{ s.label }}</button>
    </template>
  </div>

  <ul ref="listEl" class="etfs" aria-live="polite">
    <li v-for="(e, i) in visible" :key="e.ticker" class="etf" :class="{ 'just-unlocked': justUnlocked(e) }">
      <div class="top">
        <s class="ticker" :title="`${e.exchange}, z ČR nekoupíte`">{{ e.ticker }}</s>
        <span class="name">{{ e.name }}</span>
      </div>
      <div class="stats">
        <div><span>poplatek</span><b>{{ pct(e.er) }}</b></div>
        <div><span>10 let ročně</span><b :class="tone(e.r10)">{{ pct(e.r10, 1) }}</b></div>
        <div><span>poslední rok</span><b :class="tone(e.r1)">{{ pct(e.r1, 1) }}</b></div>
      </div>

      <div v-if="isOpen(e)" class="twin">
        <span class="arrow" aria-label="Evropské dvojče">→</span>
        <span class="twin-ticker">{{ e.twin.ticker }}</span>
        <span class="meta">
          <b>{{ pct(e.twin.ter) }}</b> · {{ e.twin.dist === "acc" ? "akumulační" : "vyplácí dividendy" }} · {{ MATCH[e.twin.match] }}<br />
          ISIN {{ e.twin.isin }}
        </span>
      </div>
      <div v-else class="twin twin--locked">
        <span class="arrow" aria-label="Evropské dvojče">→</span>
        <!-- placeholder text, not the real twin: the data is behind the email -->
        <span class="twin-ticker blur" aria-hidden="true">XXXX</span>
        <span class="meta blur" aria-hidden="true"><b>0,00 %</b> · xxxxxxxxx<br />ISIN IE000XXXXXXX</span>
        <button type="button" class="unlock sheen" :style="{ '--sheen-delay': sheenDelay(i) }" @click="unlock(e.ticker)">
          <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true"><rect x="1" y="5.5" width="10" height="7" rx="1.5" fill="currentColor" /><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" stroke-width="1.6" fill="none" /></svg>
          Odemknout
        </button>
      </div>
    </li>
  </ul>
  <button v-if="hidden > 0" type="button" class="btn btn--ghost btn--block more" @click="expand">Ukázat dalších {{ hidden }} ETF ↓</button>
</template>

<style scoped>
.filters { display: flex; gap: 6px; overflow-x: auto; margin: 0 calc(var(--gut) * -1); padding: 2px var(--gut) 8px; scrollbar-width: none; }
.filters::-webkit-scrollbar { display: none; }
.filters .chip { flex: none; font-family: var(--f-sans); font-size: 14px; }
.sort { font-size: 13px; color: var(--muted); margin: 4px 0 12px; }

.etfs { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.etf { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 12px 14px 0; overflow: hidden; }
.top { display: flex; align-items: baseline; gap: 10px; }
.ticker { font: 700 20px/1 var(--f-mono); color: var(--coral); text-decoration-thickness: 2px; flex: none; }
.name { font-size: 12.5px; color: var(--muted); line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 10px 0 12px; }
.stats div { display: flex; flex-direction: column; gap: 2px; }
.stats span { font-size: 11px; color: var(--muted); line-height: 1.2; }
.stats b { font: 700 15px/1.3 var(--f-mono); }
.stats .pos { color: var(--lime); }
.stats .neg { color: var(--coral); }

.twin {
  border-top: 1px dashed var(--line); margin: 0 -14px; padding: 10px 14px 12px; background: var(--surface-2);
  display: grid; grid-template-columns: auto auto 1fr; gap: 0 10px; align-items: center; min-height: 56px;
}
.twin--locked { grid-template-columns: auto auto 1fr auto; }
.arrow { font-size: 18px; color: var(--muted); }
.twin-ticker { font: 700 19px/1.1 var(--f-mono); color: var(--lime); }
.meta { font: 500 11.5px/1.45 var(--f-mono); color: var(--muted); min-width: 0; }
.meta b { color: var(--text); }
.twin--locked .meta { display: none; }
@media (min-width: 400px) { .twin--locked .meta { display: block; } }
.unlock {
  -webkit-appearance: none; appearance: none; cursor: pointer; justify-self: end;
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--lime); color: var(--lime-ink); border: 0; border-radius: 999px;
  font: 800 13px/1 var(--f-sans); padding: 0 14px; min-height: 40px; white-space: nowrap;
}
.unlock:hover { background: #fff; }
.just-unlocked .twin { animation: unlock 1.2s ease; }
@keyframes unlock { from { background: rgba(212, 255, 58, 0.35); } to { background: var(--surface-2); } }
.more { margin-top: 12px; }
</style>
