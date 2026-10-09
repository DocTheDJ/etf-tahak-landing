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
  <div class="slip calc">
    <fieldset class="field">
      <legend>Kolik měsíčně investujete? <span class="unit">Kč</span></legend>
      <div class="chips">
        <button
          v-for="a in AMOUNTS" :key="a" type="button" class="chip" :class="{ 'is-on': monthly === a }"
          @click="monthly = a; changed('monthly', a)"
        >{{ a.toLocaleString("cs-CZ") }}</button>
      </div>
    </fieldset>

    <fieldset class="field">
      <legend>Na jak dlouho?</legend>
      <div class="chips">
        <button
          v-for="y in YEARS" :key="y" type="button" class="chip" :class="{ 'is-on': years === y }"
          @click="years = y; changed('years', y)"
        >{{ y }} let</button>
      </div>
    </fieldset>

    <div class="field">
      <label for="fee">Kolik ročně platíte teď? <output class="mono">{{ pct(fee, 1) }}</output></label>
      <input id="fee" v-model.number="fee" type="range" min="0.5" max="3" step="0.1" @change="changed('fee', fee)" />
      <p class="hint">
        {{ isEsmaDefault ? "1,9 % = průměrné celkové náklady akciových fondů v EU (ESMA)" : "Celkové roční náklady najdete v dokumentu KID svého fondu." }}
      </p>
    </div>

    <div ref="resultEl" class="result" aria-live="polite">
      <p class="label">Za {{ years }} let vás poplatky stojí navíc</p>
      <p class="big mono">{{ result.loss > 0 ? "−" + czk(result.loss) : "0 Kč" }}</p>
      <div class="bars">
        <div class="bar bar--fund">
          <span class="fill" :style="{ width: (result.fund / barMax) * 100 + '%' }" />
          <span class="txt">Fond <b>{{ pct(fee, 1) }}</b> <span class="mono">{{ czk(result.fund) }}</span></span>
        </div>
        <div class="bar bar--etf">
          <span class="fill" :style="{ width: (result.etf / barMax) * 100 + '%' }" />
          <span class="txt">ETF <b>{{ pct(etfFee) }}</b> <span class="mono">{{ czk(result.etf) }}</span></span>
        </div>
      </div>
      <p class="fine">
        Vloženo celkem <span class="mono">{{ czk(result.paid) }}</span>. Předpoklad: trh vydělá {{ GROSS_RETURN }} % ročně před poplatky.
        ETF = evropské dvojče VOO ({{ etfTicker }}, {{ pct(etfFee) }}). Minulé výnosy nezaručují budoucí.
      </p>
    </div>
  </div>
</template>

<style scoped>
.calc { margin: 6px 0 22px; padding-top: 14px; }
.calc::before { left: 18%; }
.field { border: 0; margin: 0 0 12px; padding: 0; min-width: 0; }
.field legend, .field label { display: block; font-weight: 700; font-size: 15px; margin: 0 0 8px; padding: 0; }
.unit { font-weight: 500; color: var(--ink-3); }
.field output { float: right; font-weight: 700; background: var(--ink); color: var(--marker); padding: 2px 7px; border-radius: 3px; font-size: 14px; }
.hint { font-size: 12.5px; color: var(--ink-3); margin: 2px 0 0; line-height: 1.35; }
input[type="range"] { width: 100%; height: 30px; accent-color: var(--ink); margin: 0; }

.result { border-top: 2px dashed var(--ink); margin: 2px -16px 0; padding: 12px 16px 2px; }
.label { margin: 0; font-weight: 600; font-size: 15px; color: var(--ink-2); }
.big { margin: 2px 0 10px; color: var(--red); font-weight: 700; font-size: clamp(38px, 12vw, 56px); line-height: 1.05; letter-spacing: -0.03em; }
.bars { display: grid; gap: 6px; }
.bar { position: relative; height: 36px; border: var(--line); border-radius: 3px; background: #fff; overflow: hidden; }
.fill { position: absolute; inset: 0 auto 0 0; transition: width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
.bar--fund .fill { background: repeating-linear-gradient(-45deg, #f2c6c2 0 6px, #f8dcd9 6px 12px); }
.bar--etf .fill { background: var(--marker); }
.txt { position: relative; display: flex; align-items: center; height: 100%; padding: 0 10px; font-size: 14px; gap: 6px; }
.txt .mono { font-weight: 700; margin-left: auto; }
.fine { font-size: 12.5px; color: var(--ink-3); line-height: 1.4; margin: 10px 0 4px; }
</style>
