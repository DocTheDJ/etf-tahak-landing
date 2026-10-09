// Typed access to the generated data file (scripts/fetch-data.mjs writes etfs.json).
import raw from "./etfs.json";

export type Category = "sp500" | "usa" | "world" | "dividend" | "tech" | "gold";
export type TwinMatch = "same" | "close" | "similar";

export interface Twin {
  isin: string;
  ticker: string;      // Xetra ticker (what a Czech broker usually lists)
  alt?: string;        // London ticker, if different
  match: TwinMatch;
  name: string;
  ter: number;         // % per year
  dist: "acc" | "dist";
  sizeEurM: number;
  url: string;
}

export interface Etf {
  ticker: string;
  name: string;
  issuer: string;
  cat: Category;
  focus: string;       // Czech label, e.g. "Celý svět"
  exchange: string;    // always "NYSE Arca" (fetch-data fails otherwise)
  er: number;          // expense ratio, % per year
  aum: string;
  yield: number;
  price: number;
  r1: number | null;   // annualised total return in USD, %
  r5: number | null;
  r10: number | null;
  srcUS: string;
  twin: Twin;
}

export interface EtfData {
  asOf: string;        // YYYY-MM-DD
  generated: string;
  sources: Record<string, string>;
  esma: { fundTotal: number; fundOngoing: number; fundEntry: number; etfTotal: number; etfOngoing: number };
  etfs: Etf[];
}

export const data = raw as EtfData;
export const etfs = data.etfs;

export function byTicker(ticker: string): Etf {
  const e = etfs.find((x) => x.ticker === ticker);
  if (!e) throw new Error(`Unknown ETF ${ticker}`);
  return e;
}

/** Twins shown openly before sign-up: the same three pairs as in the twins hero and in ad B. */
export const FREE_TWINS = ["VOO", "SPY", "VT"];

/** The buyable ETF the calculator compares against: VOO's twin (VUAA). */
export const CALC_ETF = byTicker("VOO").twin;
