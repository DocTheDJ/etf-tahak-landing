// The fee calculator: what a yearly fee costs over time with regular monthly investing.

/** Assumed market return before fees, % per year. Stated next to the result on the page. */
export const GROSS_RETURN = 7;

/** Average total cost of EU equity funds (non-ETF), ESMA 2025 report, p. 6. Default for the slider. */
export const ESMA_FUND_COST = 1.9;

/** Value after `years` of investing `monthly` at the end of each month, with `fee` % taken yearly. */
export function futureValue(monthly: number, years: number, fee: number, gross = GROSS_RETURN): number {
  const r = Math.pow(1 + (gross - fee) / 100, 1 / 12) - 1;
  const n = years * 12;
  return r === 0 ? monthly * n : (monthly * (Math.pow(1 + r, n) - 1)) / r;
}

export interface FeeComparison {
  fund: number;   // end value with the current (expensive) fee
  etf: number;    // end value with the ETF fee
  loss: number;   // what the fee difference costs, >= 0
  paid: number;   // total contributions
}

export function compareFees(monthly: number, years: number, fundFee: number, etfFee: number): FeeComparison {
  const fund = futureValue(monthly, years, fundFee);
  const etf = futureValue(monthly, years, etfFee);
  return { fund, etf, loss: Math.max(0, etf - fund), paid: monthly * 12 * years };
}
