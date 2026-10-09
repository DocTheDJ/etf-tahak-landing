// Pulls live data for the comparison table and writes public/data/etfs.json.
//
//   node scripts/fetch-data.mjs
//
// Sources (cited on the page and in the PDF):
//   - Yahoo Finance chart API: listing exchange, price, dividend-adjusted closes -> total returns
//   - stockanalysis.com ETF pages: expense ratio, assets, dividend yield (issuer data)
//   - justETF fund profiles: TER, fund size and distribution policy of the UCITS twins
//
// Each US ETF is mapped by hand to a UCITS "twin" that a Czech retail investor can actually buy.
// `match` says how close the twin is: "same" = same index, "close" = near-identical exposure,
// "similar" = same idea, different index.

import { writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const ETFS = [
  { t: "VOO",  cat: "sp500",    cz: "S&P 500",               twin: { isin: "IE00BFMXXD54", ticker: "VUAA", match: "same" } },
  { t: "IVV",  cat: "sp500",    cz: "S&P 500",               twin: { isin: "IE00B5BMR087", ticker: "SXR8", alt: "CSPX", match: "same" } },
  { t: "SPY",  cat: "sp500",    cz: "S&P 500",               twin: { isin: "IE000XZSV718", ticker: "SPYL", match: "same" } },
  { t: "SPYM", cat: "sp500",    cz: "S&P 500",               twin: { isin: "IE000XZSV718", ticker: "SPYL", match: "same" } },
  { t: "VTI",  cat: "usa",      cz: "Celý trh USA",          twin: { isin: "IE00BJ0KDR00", ticker: "XD9U", match: "close" } },
  { t: "VT",   cat: "world",    cz: "Celý svět",             twin: { isin: "IE00BK5BQT80", ticker: "VWCE", match: "close" } },
  { t: "VEA",  cat: "world",    cz: "Vyspělý svět bez USA",  twin: { isin: "IE0006WW1TQ4", ticker: "EXUS", match: "close" } },
  { t: "VWO",  cat: "world",    cz: "Rozvíjející se trhy",   twin: { isin: "IE00BK5BR733", ticker: "VFEA", match: "close" } },
  { t: "SCHD", cat: "dividend", cz: "Dividendy USA",         twin: { isin: "IE00BYXVGX24", ticker: "FUSD", match: "similar" } },
  { t: "VYM",  cat: "dividend", cz: "Dividendy USA",         twin: { isin: "IE00B8GKDB10", ticker: "VGWD", alt: "VHYL", match: "similar" } },
  { t: "VGT",  cat: "tech",     cz: "Technologie USA",       twin: { isin: "IE00B3WJKG14", ticker: "QDVE", alt: "IUIT", match: "close" } },
  { t: "GLD",  cat: "gold",     cz: "Zlato",                 twin: { isin: "IE00B4ND3602", ticker: "PPFB", alt: "IGLN", match: "same" } },
];

async function get(url, as = "text") {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
    if (res.ok) return as === "json" ? res.json() : res.text();
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  throw new Error(`GET ${url} failed`);
}

const plain = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

function cagr(points, years) {
  const last = points[points.length - 1];
  const target = last.ts - years * 365.25 * 86400;
  // first point on/after the target date
  const start = points.find((p) => p.ts >= target);
  if (!start || start.ts - target > 10 * 86400) return null; // fund too young
  const span = (last.ts - start.ts) / (365.25 * 86400);
  return (Math.pow(last.v / start.v, 1 / span) - 1) * 100;
}

async function yahoo(t) {
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=10y&interval=1d`, "json");
  const r = j.chart.result[0];
  const adj = r.indicators.adjclose[0].adjclose;
  const points = r.timestamp.map((ts, i) => ({ ts, v: adj[i] })).filter((p) => p.v != null);
  // the full 10y window sometimes starts a few days late; fetch max history for the 10y figure
  let r10 = cagr(points, 10);
  if (r10 == null) {
    const jm = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=max&interval=1d`, "json");
    const rm = jm.chart.result[0];
    const pm = rm.timestamp.map((ts, i) => ({ ts, v: rm.indicators.adjclose[0].adjclose[i] })).filter((p) => p.v != null);
    r10 = cagr(pm, 10);
  }
  return {
    name: r.meta.longName,
    exchange: r.meta.fullExchangeName === "NYSEArca" ? "NYSE Arca" : r.meta.fullExchangeName,
    price: r.meta.regularMarketPrice,
    asOf: new Date(points[points.length - 1].ts * 1000).toISOString().slice(0, 10),
    r1: cagr(points, 1),
    r5: cagr(points, 5),
    r10,
  };
}

async function stockanalysis(t) {
  const txt = plain(await get(`https://stockanalysis.com/etf/${t.toLowerCase()}/`));
  const num = (re) => { const m = txt.match(re); return m ? m[1] : null; };
  return {
    er: parseFloat(num(/Expense Ratio\s+([0-9.]+)%/)),
    aum: num(/Assets\s+\$([0-9.]+[BTM])/),
    yield: parseFloat(num(/Dividend Yield\s+([0-9.]+)%/)) || 0,
    issuer: num(/ETF Provider\s+([A-Za-z ]+?)\s+(?:Index|Website|Asset)/),
  };
}

const twinCache = {};
async function justetf(isin) {
  if (twinCache[isin]) return twinCache[isin];
  const html = await get(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`);
  const txt = plain(html);
  const out = {
    name: (html.match(/<title>([^|<]+)/) || [])[1]?.trim(),
    ter: parseFloat((txt.match(/Total expense ratio ([0-9.]+)% p\.a\./) || [])[1]),
    dist: (txt.match(/Distribution policy (Accumulating|Distributing)/) || [])[1] === "Accumulating" ? "acc" : "dist",
    sizeEurM: parseInt(((txt.match(/Fund size EUR ([0-9,]+) m/) || [])[1] || "0").replace(/,/g, ""), 10),
    url: `https://www.justetf.com/en/etf-profile.html?isin=${isin}`,
  };
  twinCache[isin] = out;
  return out;
}

const rows = [];
for (const e of ETFS) {
  const [y, s, tw] = await Promise.all([yahoo(e.t), stockanalysis(e.t), justetf(e.twin.isin)]);
  if (y.exchange !== "NYSE Arca") throw new Error(`${e.t} is listed on ${y.exchange}, not NYSE Arca`);
  const round = (x) => (x == null ? null : Math.round(x * 10) / 10);
  rows.push({
    ticker: e.t,
    name: y.name,
    issuer: s.issuer,
    cat: e.cat,
    focus: e.cz,
    exchange: y.exchange,
    er: s.er,
    aum: s.aum,
    yield: s.yield,
    price: y.price,
    r1: round(y.r1),
    r5: round(y.r5),
    r10: round(y.r10),
    srcUS: `https://stockanalysis.com/etf/${e.t.toLowerCase()}/`,
    twin: { ...e.twin, ...tw },
  });
  console.log(`${e.t.padEnd(5)} ${y.exchange}  ER ${s.er}%  10y ${round(y.r10)}%  ->  ${e.twin.ticker} ${tw.ter}% ${tw.dist}`);
}

const out = {
  asOf: rows[0] && (await yahoo("VOO")).asOf,
  generated: new Date().toISOString(),
  sources: {
    prices: "Yahoo Finance (dividend-adjusted close, USD)",
    fees: "stockanalysis.com (issuer data)",
    twins: "justETF.com",
    fundCosts: "ESMA, Costs and Performance of EU Retail Investment Products 2025 (3 March 2026), p. 6",
  },
  // ESMA 2025 report, p. 6: average annual costs of EU equity UCITS (non-ETF) for retail investors, 2020–2024
  esma: { fundTotal: 1.9, fundOngoing: 1.38, fundEntry: 0.51, etfTotal: 0.5, etfOngoing: 0.22 },
  etfs: rows,
};

await writeFile(new URL("../public/data/etfs.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`\nwrote public/data/etfs.json (as of ${out.asOf})`);
