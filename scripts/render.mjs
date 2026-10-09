// Builds the lead magnet and the ad creatives from the live data, using headless Chrome/Edge.
//
//   node scripts/render.mjs
//
// Outputs:
//   public/tahak/tahak.html            -> public/tahak/etf-tahak-2026.pdf   (the cheat sheet, 2× A4)
//   public/ads/ad-fees.html  (feed|story) -> public/ads/ad-fees-feed.png, ad-fees-story.png
//   public/ads/ad-twins.html (feed|story) -> public/ads/ad-twins-feed.png, ad-twins-story.png
//   public/ads/og.html                    -> public/img/og.png
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const pub = (...p) => join(root, "public", ...p);

const CHROME = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!CHROME) throw new Error("No Chrome/Edge found. Set CHROME=/path/to/chrome");

const data = JSON.parse(await readFile(pub("data", "etfs.json"), "utf8"));
const d = new Date(data.asOf + "T12:00:00");
const asOf = `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
const pct = (x, n = 2) => (x == null ? "–" : x.toLocaleString("cs-CZ", { minimumFractionDigits: n, maximumFractionDigits: n }) + " %");
const MATCH = { same: "stejný index", close: "téměř stejný", similar: "podobná strategie" };

// ------------------------------------------------------------------ cheat sheet
const rows = data.etfs.map((e) => `
  <tr>
    <td><b>${e.ticker}</b><small>${e.focus}</small></td>
    <td class="n">${pct(e.er)}</td>
    <td class="n">${pct(e.r10, 1)}</td>
    <td class="arrow">→</td>
    <td class="twin"><b>${e.twin.ticker}</b>${e.twin.alt ? `<small>London: ${e.twin.alt}</small>` : ""}</td>
    <td class="isin">${e.twin.isin}</td>
    <td class="n">${pct(e.twin.ter)}</td>
    <td>${e.twin.dist === "acc" ? "akum." : "dist."}</td>
    <td>${MATCH[e.twin.match]}</td>
  </tr>`).join("");

const tahak = `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><title>ETF tahák 2026</title>
<meta name="robots" content="noindex">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Caveat:wght@600&family=JetBrains+Mono:wght@500;700&display=block" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 400 10.5pt/1.42 "Archivo", sans-serif; color: #16140f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; height: 297mm; padding: 13mm 13mm 11mm; position: relative; overflow: hidden; page-break-after: always;
    background-color: #fbf9f4; background-image: linear-gradient(rgba(60,90,140,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(60,90,140,.08) 1px, transparent 1px); background-size: 5mm 5mm; }
  .page:last-child { page-break-after: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #16140f; padding-bottom: 3mm; margin-bottom: 5mm; }
  .logo { display: inline-flex; transform: rotate(-1.5deg); }
  .logo i { font: 700 9pt/1 "JetBrains Mono"; background: #16140f; color: #ffe45c; padding: 4px 5px; font-style: normal; }
  .logo b { font-weight: 850; font-variation-settings: "wdth" 80; font-size: 14pt; line-height: 1; border: 1.5px solid #16140f; border-left: 0; padding: 1px 6px; }
  h1 { font-weight: 880; font-variation-settings: "wdth" 70; font-size: 24pt; line-height: 1; margin: 0; }
  h2 { font-weight: 850; font-variation-settings: "wdth" 78; font-size: 15pt; line-height: 1.1; margin: 0 0 2.5mm; }
  .meta { font: 500 8pt/1.3 "JetBrains Mono"; color: #4a463d; text-align: right; white-space: nowrap; }
  mark { background: linear-gradient(transparent 40%, #ffe45c 40%); color: inherit; padding: 0 2px; }
  .box { border: 1.5px solid #16140f; background: #fff; padding: 3.5mm 4mm; box-shadow: 2px 2px 0 #16140f; margin-bottom: 5mm; }
  .box p { margin: 0; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1.5px solid #16140f; font-size: 9pt; }
  th { background: #16140f; color: #ffe45c; font: 700 7.5pt/1.2 "Archivo"; text-align: left; padding: 2.2mm 2mm; }
  td { padding: 1.4mm 2mm; border-top: 1px solid #d9d3c6; vertical-align: middle; }
  td b { font: 700 10.5pt/1.1 "JetBrains Mono"; display: block; }
  td small { display: block; font-size: 7.2pt; color: #7b766a; line-height: 1.2; }
  td.n { font-family: "JetBrains Mono"; text-align: right; white-space: nowrap; }
  td.isin { font: 500 8pt "JetBrains Mono"; }
  td.twin b { color: #0c7448; background: linear-gradient(transparent 50%, #ffe45c 50%); display: inline; }
  td.arrow { font-size: 12pt; padding: 0 1mm; }
  tr td:first-child b { text-decoration: line-through; text-decoration-color: #c8281f; text-decoration-thickness: 2px; }
  .legend { font-size: 8pt; color: #4a463d; margin: 2mm 0 4mm; }
  .note { font: 600 14pt/1 "Caveat"; color: #c8281f; position: absolute; transform: rotate(-4deg); }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  ol, ul { margin: 0; padding-left: 5mm; }
  li { margin: 0 0 1.8mm; }
  .tax li b { background: #ffe45c; padding: 0 2px; }
  .steps { counter-reset: s; list-style: none; padding: 0; }
  .steps li { counter-increment: s; padding-left: 8mm; position: relative; }
  .steps li::before { content: counter(s); position: absolute; left: 0; top: 0; width: 5.2mm; height: 5.2mm; border: 1.5px solid #16140f; border-radius: 50%; background: #ffe45c; font: 700 8pt/4.6mm "JetBrains Mono"; text-align: center; }
  .foot { position: absolute; left: 13mm; right: 13mm; bottom: 9mm; font-size: 7pt; color: #7b766a; border-top: 1px solid #16140f; padding-top: 2mm; }
  .foot a { color: inherit; }
</style></head><body>

<section class="page">
  <div class="head">
    <div><div class="logo"><i>ETF</i><b>tahák</b></div><h1 style="margin-top:3mm">12 amerických ETF a <mark>jejich evropská dvojčata</mark></h1></div>
    <div class="meta">data k ${asOf}<br>strana 1/2</div>
  </div>

  <div class="box"><p><b>Proč VOO nebo SPY u brokera nekoupíte:</b> v EU platí od roku 2018 nařízení PRIIPs. Fond nabízený drobným investorům musí mít dokument KID. Americké ETF ho nevydávají, takže je evropští brokeři běžným klientům blokují. Řešení: <b>evropské (irské) dvojče na stejný nebo velmi podobný index</b>. Pro investora z Česka je navíc často výhodnější.</p></div>

  <table>
    <thead><tr><th>Americké ETF<br>(NYSE Arca)</th><th>Poplatek</th><th>10 let<br>ročně*</th><th></th><th>Dvojče<br>(Xetra, EUR)</th><th>ISIN</th><th>Poplatek</th><th>Typ</th><th>Shoda</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="legend">* Průměrný roční výnos v USD vč. reinvestovaných dividend, k ${asOf}. Minulé výnosy nezaručují budoucí. <b>akum.</b> = dividendy se automaticky reinvestují. <b>dist.</b> = dividendy chodí na účet. <b>Ticker se mezi burzami liší, hledejte vždy podle ISIN.</b> Dvojčata VYM a SCHD nekopírují stejný index, jen podobnou strategii (VGWD je navíc globální).</p>

  <div class="cols">
    <div class="box" style="margin:0">
      <h2>Kterou S&amp;P 500 vybrat?</h2>
      <p>VUAA, SXR8 i SPYL kopírují stejný index se stejným výsledkem. Rozhoduje poplatek (<b>SPYL ${pct(data.etfs.find((e) => e.ticker === "SPY").twin.ter)}</b>), dostupnost u vašeho brokera a poplatek za nákup. Rozdíl mezi nimi je menší než rozdíl mezi jakýmkoli z nich a fondem za 1,9 %.</p>
    </div>
    <div class="box" style="margin:0">
      <h2>Kolik stojí 1,9 % ročně</h2>
      <p>5 000 Kč měsíčně, 20 let, trh +7 % ročně: fond za 1,9 % ≈ <b>2,05 mil. Kč</b>, ETF za 0,07 % ≈ <b>2,52 mil. Kč</b>. Rozdíl <b style="color:#c8281f">466 000 Kč</b>. 1,9 % = průměrné celkové náklady akciových fondů v EU (ESMA 2026).</p>
    </div>
  </div>

  <div class="foot">Zdroje: Yahoo Finance (ceny a výnosy), stockanalysis.com (poplatky US ETF dle emitentů), justETF (dvojčata: TER, ISIN, tickery), ESMA Costs and Performance of EU Retail Investment Products 2025, str. 6. Nejde o investiční doporučení.</div>
</section>

<section class="page">
  <div class="head">
    <div><div class="logo"><i>ETF</i><b>tahák</b></div><h1 style="margin-top:3mm">Daně a <mark>5 kroků k prvnímu nákupu</mark></h1></div>
    <div class="meta">stav pro rok 2026<br>strana 2/2</div>
  </div>

  <div class="cols">
    <div>
      <h2>Daně v Česku na jedné straně</h2>
      <ul class="tax">
        <li><b>Časový test 3 roky.</b> Když ETF prodáte po víc než 3 letech držení, zisk je osvobozený od daně. Od roku 2026 bez stropu 40 mil. Kč.</li>
        <li><b>Limit 100 000 Kč.</b> Když vaše celkové příjmy z prodeje cenných papírů za rok nepřesáhnou 100 000 Kč, neplatíte daň ani bez časového testu. Pozor, počítá se celá prodejní částka, ne zisk.</li>
        <li><b>Akumulační ETF = žádné dividendy k danění.</b> Výnos se reinvestuje uvnitř fondu, do přiznání nic nepíšete, dokud neprodáte.</li>
        <li><b>Distribuční ETF.</b> Dividendy uvádíte v daňovém přiznání a danění se 15 %.</li>
        <li><b>W-8BEN</b> řešíte jen u amerických akcií a ETF, které už máte. Sníží srážku z dividend z 30 % na 15 %.</li>
        <li><b>DIP (Dlouhodobý investiční produkt).</b> Vklady si odečtete ze základu daně, až 48 000 Kč ročně (společný limit s penzijkem a životním pojištěním). Zaměstnavatel může přispět až 50 000 Kč ročně bez daně. Podmínka: vybrat nejdřív po 10 letech a v 60 letech.</li>
        <li><b>Americká dědická daň</b> může dopadnout na americké ETF nad 60 000 USD. Irských dvojčat se netýká.</li>
      </ul>
    </div>
    <div>
      <h2>5 kroků k prvnímu nákupu</h2>
      <ol class="steps">
        <li><b>Vyberte index.</b> Většině lidí stačí jeden: S&amp;P 500 (USA) nebo celý svět (VWCE).</li>
        <li><b>Otevřete účet u brokera</b>, který nabízí ETF z Xetry. Chcete odpočet daně? Rovnou jako DIP.</li>
        <li><b>Najděte dvojče podle ISIN</b> z tabulky. Ticker se liší podle burzy, ISIN ne.</li>
        <li><b>Nastavte pravidelnou investici</b>, třeba den po výplatě. Nemusíte trefovat správný okamžik.</li>
        <li><b>Nechte to být aspoň 3 roky</b> kvůli časovému testu. Nejlépe mnohem déle.</li>
      </ol>

      <h2 style="margin-top:5mm">Na co si dát pozor</h2>
      <ul>
        <li><b>Poplatky brokera</b> za nákup a převod měny bývají vyšší než samotný poplatek ETF. Porovnejte je.</li>
        <li><b>Měnové riziko.</b> ETF jsou v USD nebo EUR, vy žijete v korunách.</li>
        <li><b>Malé a pákové ETF</b> nejsou pro začátek. Držte se velkých fondů z tabulky.</li>
        <li><b>Propady přijdou.</b> S&amp;P 500 v roce 2022 ztratil přes 18 %. Kdo v panice neprodal, byl do dvou let zpátky. Záruka to ale není.</li>
      </ul>
    </div>
  </div>

  <div class="box" style="margin-top:5mm">
    <p><b>Co dál?</b> Během příštích dní vám pošleme 4 krátké e-maily: jak vybrat brokera, jak nastavit pravidelnou investici, daně podrobněji a DIP krok za krokem. Žádné telefonáty, žádný poradce.</p>
  </div>

  <div class="foot">ETF tahák není investiční doporučení ani nabídka investičních služeb. Investování nese riziko ztráty. Minulé výnosy nejsou zárukou budoucích. Daňové informace jsou zjednodušené (zákon č. 586/1992 Sb. o daních z příjmů, stav 2026) a ve vaší situaci se mohou lišit.</div>
</section>
</body></html>`;

await mkdir(pub("tahak"), { recursive: true });
await writeFile(pub("tahak", "tahak.html"), tahak);

// ------------------------------------------------------------------ chrome helpers
function chrome(args) {
  execFileSync(CHROME, [...(process.env.CI ? ["--no-sandbox"] : []), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--run-all-compositor-stages-before-draw", "--virtual-time-budget=8000", ...args], { stdio: "pipe" });
}
const fileUrl = (p, q = "") => pathToFileURL(p).href + q;

chrome([`--print-to-pdf=${pub("tahak", "etf-tahak-2026.pdf")}`, "--no-pdf-header-footer", fileUrl(pub("tahak", "tahak.html"))]);
console.log("pdf   public/tahak/etf-tahak-2026.pdf");

const shots = [
  ["ad-fees.html", "?f=feed", 1080, 1350, pub("ads", "ad-fees-feed.png")],
  ["ad-fees.html", "?f=story", 1080, 1920, pub("ads", "ad-fees-story.png")],
  ["ad-twins.html", "?f=feed", 1080, 1350, pub("ads", "ad-twins-feed.png")],
  ["ad-twins.html", "?f=story", 1080, 1920, pub("ads", "ad-twins-story.png")],
  ["og.html", "", 1200, 630, pub("img", "og.png")],
];
for (const [file, q, w, h, out] of shots) {
  chrome([`--window-size=${w},${h}`, "--force-device-scale-factor=1", `--screenshot=${out}`, fileUrl(pub("ads", file), q)]);
  console.log(`png   ${out.replace(root, "").replace(/\\/g, "/")}`);
}
