<script setup lang="ts">
// Fee calculator: monthly amount × years × current fee → what the fee difference costs vs. a buyable ETF.
// State and maths live in the calculator store (shared with the lead form); this component is the UI.
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { ESMA_FUND_COST, GROSS_RETURN } from "@/lib/calc";
import { czk, pct } from "@/lib/format";
import { track } from "@/lib/tracking";
import { useCalculatorStore } from "@/stores/calculator";
import Chip from "./ui/Chip.vue";

const props = defineProps<{ etfTicker: string; etfFee: number }>();

const AMOUNTS = [2000, 5000, 10000, 20000];
const YEARS = [10, 20, 30];

const calc = useCalculatorStore();
calc.etfFee = props.etfFee;
const { monthly, years, fee, result } = storeToRefs(calc);

const barMax = computed(() => Math.max(result.value.fund, result.value.etf));
const isEsmaDefault = computed(() => Math.abs(fee.value - ESMA_FUND_COST) < 0.05);
const lossText = computed(() => (result.value.loss > 0 ? "−" + czk(result.value.loss) : "0 Kč"));
const lossChars = computed(() => lossText.value.length + 1); // + the blinking caret (see fit-to-width)

function changed(field: string, value: number) {
  if (!calc.touched) {
    calc.touched = true;
    track("calc_interact", { field });
  }
  track("calc_change", { field, value, loss: calc.loss });
}

const resultEl = ref<HTMLElement | null>(null);
onMounted(() => {
  if (!resultEl.value || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { track("calc_result_view", { loss: calc.loss }, { once: "calc_result" }); io.disconnect(); }
  }, { threshold: 0.6 });
  io.observe(resultEl.value);
});
</script>

<template>
  <div class="mt-1 mb-[18px] flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4">
    <fieldset class="min-w-0">
      <legend class="mb-2 block text-[13px] text-muted">Měsíčně investuji <span class="opacity-70">Kč</span></legend>
      <div class="flex flex-wrap gap-1.5">
        <Chip v-for="a in AMOUNTS" :key="a" fill :on="monthly === a" @click="monthly = a; changed('monthly', a)">
          {{ a.toLocaleString("cs-CZ") }}
        </Chip>
      </div>
    </fieldset>

    <fieldset class="min-w-0">
      <legend class="mb-2 block text-[13px] text-muted">Po dobu</legend>
      <div class="flex flex-wrap gap-1.5">
        <Chip v-for="y in YEARS" :key="y" fill :on="years === y" @click="years = y; changed('years', y)">{{ y }} let</Chip>
      </div>
    </fieldset>

    <div>
      <label for="fee" class="mb-2 block text-[13px] text-muted">
        Můj fond si bere ročně
        <output class="float-right rounded-[6px] bg-lime px-[7px] py-0.5 font-mono text-[13px] font-bold text-ink tabular-nums">{{ pct(fee, 1) }}</output>
      </label>
      <input id="fee" v-model.number="fee" type="range" min="0.5" max="3" step="0.1" class="m-0 h-7 w-full accent-lime" @change="changed('fee', fee)" />
      <p class="mt-1 text-[12px] leading-[1.35] text-muted">
        {{ isEsmaDefault ? "1,9 % = průměrné celkové náklady akciových fondů v EU (ESMA)" : "Celkové roční náklady najdete v dokumentu KID svého fondu." }}
      </p>
    </div>

    <div ref="resultEl" class="@container border-t border-dashed border-line pt-3.5" aria-live="polite" data-testid="calc-result">
      <p class="text-[13px] text-muted">Za {{ years }} let vás fond oproti ETF stojí</p>
      <!-- :key replays the entrance animation whenever the number changes -->
      <p
        :key="result.loss"
        class="fit-to-width mt-1 mb-3 animate-rise font-mono leading-none font-bold tracking-[-0.04em] text-coral tabular-nums"
        :style="{ '--chars': lossChars }"
        data-testid="loss"
      >{{ lossText }}<span class="caret" aria-hidden="true">_</span></p>

      <div class="flex flex-col gap-2 font-mono text-[12px] leading-none font-medium">
        <div v-for="bar in [
          { name: `fond ${pct(fee, 1)}`, value: result.fund, color: 'bg-coral', key: 'f' },
          { name: `ETF ${pct(etfFee)}`, value: result.etf, color: 'bg-lime', key: 'e' },
        ]" :key="bar.key" class="flex items-center gap-2">
          <span class="w-[74px] flex-none text-muted">{{ bar.name }}</span>
          <span class="h-2.5 flex-1 overflow-hidden rounded-[5px] bg-surface-2">
            <span
              :key="bar.key + bar.value"
              class="block h-full origin-left animate-grow rounded-[5px]"
              :class="bar.color"
              :style="{ width: (bar.value / barMax) * 100 + '%' }"
            />
          </span>
          <span class="min-w-[92px] flex-none text-right whitespace-nowrap" data-testid="bar-value">{{ czk(bar.value) }}</span>
        </div>
      </div>

      <p class="mt-3 text-[12px] leading-[1.45] text-muted">
        Vloženo celkem <span class="font-mono tabular-nums">{{ czk(result.paid) }}</span>. Předpoklad: trh vydělá {{ GROSS_RETURN }} % ročně před poplatky.
        ETF = evropské dvojče VOO ({{ etfTicker }}). Minulé výnosy nezaručují budoucí.
      </p>
    </div>
  </div>
</template>
