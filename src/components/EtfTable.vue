<script setup lang="ts">
// The comparison: 12 NYSE ETFs with their European twins. Filter, sort, show 6 then all.
// Twins are blurred until sign-up (except the 3 shown in the hero/ad); a locked twin is a CTA to the form.
import { computed, onMounted, ref } from "vue";
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

  <ul class="etfs" aria-live="polite">
    <li v-for="e in visible" :key="e.ticker" class="etf" :class="{ 'just-unlocked': justUnlocked(e) }">
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
        <button type="button" class="unlock" @click="unlock(e.ticker)">
          <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true"><rect x="1" y="5.5" width="10" height="7" rx="1.5" fill="currentColor" /><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" stroke-width="1.6" fill="none" /></svg>
          Odemknout
        </button>
      </div>
    </li>
  </ul>
  <button v-if="hidden > 0" type="button" class="btn btn--ghost btn--block more" @click="expand">Ukázat dalších {{ hidden }} ETF ↓</button>
</template>

<style scoped>
.filters { display: flex; gap: 8px; overflow-x: auto; margin: 0 calc(var(--gut) * -1); padding: 2px var(--gut) 8px; scrollbar-width: none; }
.filters::-webkit-scrollbar { display: none; }
.filters .chip { flex: none; }
.sort { font-size: 14px; color: var(--ink-2); margin: 4px 0 12px; }

.etfs { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.etf { background: var(--paper-2); border: var(--line); border-radius: var(--r); padding: 10px 12px 0; overflow: hidden; }
.top { display: flex; align-items: baseline; gap: 10px; }
.ticker { font: 700 21px/1 var(--f-mono); text-decoration-color: var(--red); text-decoration-thickness: 2.5px; color: var(--ink-2); flex: none; }
.name { font-size: 12.5px; color: var(--ink-3); line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0 10px; }
.stats div { display: flex; flex-direction: column; }
.stats span { font-size: 11.5px; color: var(--ink-3); line-height: 1.2; }
.stats b { font: 700 15px/1.3 var(--f-mono); }
.stats .pos { color: var(--green); }
.stats .neg { color: var(--red); }

.twin {
  border-top: 1.5px dashed var(--ink); margin: 0 -12px; padding: 9px 12px 10px; background: var(--marker-soft);
  display: grid; grid-template-columns: auto auto 1fr; gap: 0 9px; align-items: center; min-height: 54px;
}
.twin--locked { grid-template-columns: auto auto 1fr auto; }
.arrow { font-size: 18px; }
.twin-ticker { font: 700 19px/1.1 var(--f-mono); color: var(--green); background: linear-gradient(transparent 55%, var(--marker) 55%); padding: 0 2px; }
.meta { font: 500 12px/1.4 var(--f-mono); color: var(--ink-2); min-width: 0; }
.meta b { color: var(--ink); }
.twin--locked .meta { display: none; }
@media (min-width: 400px) { .twin--locked .meta { display: block; } }
.unlock {
  -webkit-appearance: none; appearance: none; cursor: pointer; justify-self: end;
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--ink); color: var(--marker); border: 0; border-radius: 999px;
  font: 700 13px/1 var(--f-sans); padding: 0 12px; min-height: 36px; white-space: nowrap;
}
.just-unlocked .twin { animation: unlock 1.2s ease; }
@keyframes unlock { from { background: var(--marker); } to { background: var(--marker-soft); } }
.more { margin-top: 12px; }
</style>
