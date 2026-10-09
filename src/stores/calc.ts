// The calculator's current inputs and result. The lead form sends them with the lead,
// so the email can quote the visitor's own number.
import { map } from "nanostores";
import { ESMA_FUND_COST } from "@/lib/calc";

export interface CalcState {
  monthly: number;
  years: number;
  fee: number;
  loss: number;
  touched: boolean;
}

export const $calc = map<CalcState>({ monthly: 5000, years: 20, fee: ESMA_FUND_COST, loss: 0, touched: false });
