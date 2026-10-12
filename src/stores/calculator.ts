// The fee calculator's inputs and result. The lead form sends them with the lead, so the email can quote the
// visitor's own number. The maths itself is plain TypeScript in lib/calc.ts (unit-tested).
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { compareFees, ESMA_FUND_COST } from "@/lib/calc";

export const useCalculatorStore = defineStore("calculator", () => {
  // pre-filled with the ad's own example, so the result is visible before any tap
  const monthly = ref(5000);
  const years = ref(20);
  const fee = ref(ESMA_FUND_COST);
  /** Fee of the buyable ETF we compare against (VOO's twin), set by the Calculator from the data. */
  const etfFee = ref(0.07);
  /** Whether the visitor changed anything: only then are the values attached to the lead. */
  const touched = ref(false);

  const result = computed(() => compareFees(monthly.value, years.value, fee.value, etfFee.value));
  const loss = computed(() => Math.round(result.value.loss));

  /** What the lead API stores (see src/pages/api/lead.ts). */
  const snapshot = () => ({ monthly: monthly.value, years: years.value, fee: fee.value, loss: loss.value, touched: touched.value });

  return { monthly, years, fee, etfFee, touched, result, loss, snapshot };
});
