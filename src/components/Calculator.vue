<script setup lang="ts">
// Fee calculator: monthly amount × years × current fee → what the fee difference costs vs. a buyable ETF.
// Pre-filled with the ad's own example (5 000 Kč, 20 let, 1,9 %) so the result is visible before any tap.
import { computed, onMounted, ref, watch } from "vue";
import { compareFees, ESMA_FUND_COST, GROSS_RETURN } from "@/lib/calc";
import { czk, pct } from "@/lib/format";
import { track } from "@/lib/tracking";
import { $calc } from "@/stores/calc";

const props = defineProps<{ etfTicker: string; etfFee: number }>();

const AMOUNTS = [2000, 5000, 10000, 20000];
const YEARS = [10, 20, 30];

const monthly = ref(5000);
const years = ref(20);
const fee = ref(ESMA_FUND_COST);

const result = computed(() => compareFees(monthly.value, years.value, fee.value, props.etfFee));
const barMax = computed(() => Math.max(result.value.fund, result.value.etf));
const isEsmaDefault = computed(() => Math.abs(fee.value - ESMA_FUND_COST) < 0.05);

// The big loss number must stay on ONE line ("Kč" never drops below). Its font is monospaced, so its width is
// exactly characters × 0.6 em: the CSS sizes the font to fit the box (see .big), we only supply the length.
const lossText = computed(() => (result.value.loss > 0 ? "−" + czk(result.value.loss) : "0 Kč"));
const lossChars = computed(() => lossText.value.length + 1); // + the blinking caret

// Share inputs + result with the lead form (sent with the lead, quoted in the email).
watch([monthly, years, fee, result], () => {
  $calc.set({ ...$calc.get(), monthly: monthly.value, years: years.value, fee: fee.value, loss: Math.round(result.value.loss) });
}, { immediate: true });

let touched = false;
function changed(field: string, value: number) {
  if (!touched) {
    touched = true;
    $calc.setKey("touched", true);
    track("calc_interact", { field });
  }
  track("calc_change", { field, value, loss: Math.round(result.value.loss) });
}

const resultEl = ref<HTMLElement | null>(null);
onMounted(() => {
  if (!resultEl.value || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { track("calc_result_view", { loss: Math.round(result.value.loss) }, { once: "calc_result" }); io.disconnect(); }
  }, { threshold: 0.6 });
  io.observe(resultEl.value);
});
</script>

<template>
  <div class="card calc">
    <fieldset class="field">
      <legend>Měsíčně investuji <span class="unit">Kč</span></legend>
      <div class="chips chips--fill">
        <button
          v-for="a in AMOUNTS" :key="a" type="button" class="chip" :class="{ 'is-on': monthly === a }"
          @click="monthly = a; changed('monthly', a)"
        >{{ a.toLocaleString("cs-CZ") }}</button>
      </div>
    </fieldset>

    <fieldset class="field">
      <legend>Po dobu</legend>
      <div class="chips chips--fill">
        <button
          v-for="y in YEARS" :key="y" type="button" class="chip" :class="{ 'is-on': years === y }"
          @click="years = y; changed('years', y)"
        >{{ y }} let</button>
      </div>
    </fieldset>

    <div class="field">
      <label for="fee">Můj fond si bere ročně <output class="mono">{{ pct(fee, 1) }}</output></label>
      <input id="fee" v-model.number="fee" type="range" min="0.5" max="3" step="0.1" @change="changed('fee', fee)" />
      <p class="hint">
        {{ isEsmaDefault ? "1,9 % = průměrné celkové náklady akciových fondů v EU (ESMA)" : "Celkové roční náklady najdete v dokumentu KID svého fondu." }}
      </p>
    </div>

    <div ref="resultEl" class="result" aria-live="polite">
      <p class="label">Za {{ years }} let vás fond oproti ETF stojí</p>
      <!-- :key replays the entrance animation whenever the number changes -->
      <p :key="result.loss" class="big mono" :style="{ '--chars': lossChars }">{{ lossText }}<span class="caret" aria-hidden="true">_</span></p>
      <div class="bars">
        <div class="bar">
          <span class="name">fond {{ pct(fee, 1) }}</span>
          <span class="track"><span :key="'f' + result.fund" class="fill fill--fund" :style="{ width: (result.fund / barMax) * 100 + '%' }" /></span>
          <span class="val">{{ czk(result.fund) }}</span>
        </div>
        <div class="bar">
          <span class="name">ETF {{ pct(etfFee) }}</span>
          <span class="track"><span :key="'e' + result.etf" class="fill fill--etf" :style="{ width: (result.etf / barMax) * 100 + '%' }" /></span>
          <span class="val">{{ czk(result.etf) }}</span>
        </div>
      </div>
      <p class="fine">
        Vloženo celkem <span class="mono">{{ czk(result.paid) }}</span>. Předpoklad: trh vydělá {{ GROSS_RETURN }} % ročně před poplatky.
        ETF = evropské dvojče VOO ({{ etfTicker }}). Minulé výnosy nezaručují budoucí.
      </p>
    </div>
  </div>
</template>

<style scoped>
.calc { margin: 4px 0 18px; display: flex; flex-direction: column; gap: 14px; }
.field { border: 0; margin: 0; padding: 0; min-width: 0; }
.field legend, .field label { display: block; font-size: 13px; color: var(--muted); margin: 0 0 8px; padding: 0; }
.unit { opacity: 0.7; }
.field output { float: right; font-weight: 700; background: var(--lime); color: var(--lime-ink); padding: 2px 7px; border-radius: 6px; font-size: 13px; }
.hint { font-size: 12px; color: var(--muted); margin: 4px 0 0; line-height: 1.35; }
input[type="range"] { width: 100%; height: 28px; accent-color: var(--lime); margin: 0; }

.result { border-top: 1px dashed var(--line); padding-top: 14px; container-type: inline-size; }
.label { margin: 0; font-size: 13px; color: var(--muted); }
.big {
  margin: 4px 0 12px; color: var(--coral); font-weight: 700; line-height: 1; letter-spacing: -0.04em;
  white-space: nowrap; /* never wrap: "Kč" stays on the number's line */
  /* fallback for browsers without container units (pre-2022): small enough for the longest value at 320 px */
  font-size: clamp(26px, 8.4vw, 52px);
  /* fit: box width ÷ (characters × 0.6 em per monospace character), capped at the design size */
  font-size: min(52px, calc(100cqi / (var(--chars) * 0.6)));
  animation: rise 0.35s ease-out both;
}
.bars { display: flex; flex-direction: column; gap: 8px; font: 500 12px/1 var(--f-mono); }
.bar { display: flex; align-items: center; gap: 8px; }
.name { width: 74px; color: var(--muted); flex: none; }
.track { flex: 1; height: 10px; border-radius: 5px; background: var(--surface-2); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 5px; transform-origin: left center; animation: grow 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.fill--fund { background: var(--coral); }
.fill--etf { background: var(--lime); }
.val { min-width: 92px; text-align: right; flex: none; white-space: nowrap; }
.fine { font-size: 12px; color: var(--muted); line-height: 1.45; margin: 12px 0 0; }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
</style>
