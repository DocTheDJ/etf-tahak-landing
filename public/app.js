(function () {
  var C = window.ETF_CONFIG || {};
  var track = window.track || function () {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var nf = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });
  var pct = function (x, digits) {
    if (x == null || isNaN(x)) return "–";
    return x.toLocaleString("cs-CZ", { minimumFractionDigits: digits == null ? 2 : digits, maximumFractionDigits: digits == null ? 2 : digits }) + " %";
  };
  var czk = function (x) { return nf.format(Math.round(x / 1000) * 1000) + " Kč"; };

  var state = {
    data: null,
    unlocked: (function () { try { return !!localStorage.getItem("lead"); } catch (e) { return false; } })(),
    cat: "all",
    sort: "pop",
    expanded: false,
    calc: { monthly: 5000, years: 20, fee: 1.9 },
    leadId: null,
  };
  var FREE = { VOO: 1, SPY: 1, VT: 1 }; // the pairs already shown in the twins hero
  var ETF_FEE = 0.07; // VUAA, the UCITS twin of VOO; replaced with live value once data loads
  var GROSS = 7; // assumed market return before fees, % p.a.

  // ---------------------------------------------------------------- data
  fetch("/data/etfs.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.data = data;
      var byT = {};
      data.etfs.forEach(function (e) { byT[e.ticker] = e; });
      var voo = byT.VOO;
      if (voo && voo.twin && voo.twin.ter) ETF_FEE = voo.twin.ter;
      $$("[data-er]").forEach(function (el) { var e = byT[el.dataset.er]; if (e) el.textContent = pct(e.er); });
      $$("[data-ter]").forEach(function (el) { var e = byT[el.dataset.ter]; if (e) el.textContent = pct(e.twin.ter); });
      var d = new Date(data.asOf + "T12:00:00");
      var asof = d.getDate() + ". " + (d.getMonth() + 1) + ". " + d.getFullYear();
      $$("[data-asof]").forEach(function (el) { el.textContent = asof; });
      renderTable();
      renderCalc();
    })
    .catch(function () {
      $("#etfs").innerHTML = '<li class="etf etf--skeleton">Data se nepodařilo načíst. Zkuste obnovit stránku.</li>';
    });

  // ---------------------------------------------------------------- calculator
  function fv(monthly, years, fee) {
    var r = Math.pow(1 + (GROSS - fee) / 100, 1 / 12) - 1;
    var n = years * 12;
    return r === 0 ? monthly * n : monthly * (Math.pow(1 + r, n) - 1) / r;
  }

  function renderCalc() {
    var c = state.calc;
    var fund = fv(c.monthly, c.years, c.fee);
    var etf = fv(c.monthly, c.years, ETF_FEE);
    var loss = Math.max(0, etf - fund);
    state.calc.loss = Math.round(loss);
    $('[data-out="loss"]').textContent = loss > 0 ? "−" + czk(loss) : "0 Kč";
    $('[data-out="years"]').textContent = c.years + " let";
    $('[data-out="feeLbl"]').textContent = pct(c.fee, 1);
    $('[data-out="fvFund"]').textContent = czk(fund);
    $('[data-out="fvEtf"]').textContent = czk(etf);
    $('[data-out="paid"]').textContent = czk(c.monthly * 12 * c.years);
    var max = Math.max(fund, etf);
    $('[data-bar="fund"]').style.width = (fund / max) * 100 + "%";
    $('[data-bar="etf"]').style.width = (etf / max) * 100 + "%";
    $("#fee-out").textContent = pct(c.fee, 1);
    $("#fee-hint").textContent = Math.abs(c.fee - 1.9) < 0.05
      ? "1,9 % = průměrné celkové náklady akciových fondů v EU (ESMA)"
      : "Celkové roční náklady najdete v dokumentu KID svého fondu.";
  }

  var calcTouched = false;
  function calcChanged(field, value) {
    if (!calcTouched) { calcTouched = true; track("calc_interact", { field: field }); }
    renderCalc();
    track("calc_change", { field: field, value: value, loss: state.calc.loss });
  }

  $$(".calc [data-input]").forEach(function (group) {
    group.addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      $$(".chip", group).forEach(function (x) { x.classList.toggle("is-on", x === b); });
      var key = group.dataset.input;
      state.calc[key] = Number(b.dataset.val);
      calcChanged(key, state.calc[key]);
    });
  });
  var feeInput = $("#fee");
  feeInput.addEventListener("input", function () { state.calc.fee = Number(feeInput.value); renderCalc(); });
  feeInput.addEventListener("change", function () { calcChanged("fee", state.calc.fee); });
  renderCalc();

  if ("IntersectionObserver" in window) {
    var ro = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { track("calc_result_view", { loss: state.calc.loss }, { once: "calc_result" }); ro.disconnect(); }
    }, { threshold: 0.6 });
    ro.observe($(".result"));
  }

  // ---------------------------------------------------------------- table
  var MATCH = { same: "stejný index", close: "téměř stejný koš akcií", similar: "podobná strategie, jiný index" };
  var CAT = { sp500: "S&P 500", usa: "USA", world: "Svět", dividend: "Dividendy", tech: "Tech", gold: "Zlato" };
  var LOCK = '<svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true"><rect x="1" y="5.5" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>';

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function cls(x) { return x == null ? "" : x >= 0 ? "pos" : "neg"; }

  function card(e, fresh) {
    var open = state.unlocked || FREE[e.ticker];
    var t = e.twin;
    var twin = open
      ? '<span class="twin__t">' + esc(t.ticker) + "</span>" +
        '<span class="twin__meta"><b>' + pct(t.ter) + "</b> · " + (t.dist === "acc" ? "akumulační" : "vyplácí dividendy") + " · " + MATCH[t.match] + "<br>ISIN " + esc(t.isin) + "</span>"
      : '<span class="twin__t blur" aria-hidden="true">XXXX</span><span class="twin__meta blur" aria-hidden="true"><b>0,00 %</b> · xxxxxxxxx<br>ISIN IE000XXXXXXX</span>' +
        '<button type="button" class="twin__unlock" data-unlock="' + esc(e.ticker) + '">' + LOCK + " Odemknout</button>";
    return (
      '<li class="etf' + (fresh ? " is-new" : "") + '" data-t="' + esc(e.ticker) + '">' +
        '<div class="etf__top"><s class="etf__t" title="' + esc(e.exchange) + ', z ČR nekoupíte">' + esc(e.ticker) + '</s><span class="etf__name">' + esc(e.name) + "</span></div>" +
        '<div class="etf__stats">' +
          '<div class="stat"><span>poplatek</span><b>' + pct(e.er) + "</b></div>" +
          '<div class="stat"><span>10 let ročně</span><b class="' + cls(e.r10) + '">' + pct(e.r10, 1) + "</b></div>" +
          '<div class="stat"><span>poslední rok</span><b class="' + cls(e.r1) + '">' + pct(e.r1, 1) + "</b></div>" +
        "</div>" +
        '<div class="twin' + (open ? "" : " twin--locked") + '"><span class="twin__arrow" aria-label="Evropské dvojče">→</span>' + twin + "</div>" +
      "</li>"
    );
  }

  var SHOW = 6;
  function renderTable(fresh) {
    if (!state.data) return;
    var order = {};
    state.data.etfs.forEach(function (e, i) { order[e.ticker] = i; }); // fetch-data order = popularity
    var rows = state.data.etfs.filter(function (e) {
      return state.cat === "all" || e.cat === state.cat;
    });
    rows.sort(function (a, b) {
      if (state.sort === "er") return a.er - b.er || order[a.ticker] - order[b.ticker];
      if (state.sort === "r10") return (b.r10 || 0) - (a.r10 || 0);
      return order[a.ticker] - order[b.ticker];
    });
    var cut = state.expanded || rows.length <= SHOW + 1 ? rows.length : SHOW;
    $("#etfs").innerHTML = rows.slice(0, cut).map(function (e) { return card(e, fresh); }).join("");
    var more = $("#etfs-more");
    more.hidden = cut >= rows.length;
    more.textContent = "Ukázat dalších " + (rows.length - cut) + " ETF ↓";
  }

  $("#etfs-more").addEventListener("click", function () {
    state.expanded = true;
    renderTable();
    track("table_expand", { cat: state.cat });
  });

  $(".filters").addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b) return;
    $$(".filters .chip").forEach(function (x) { x.classList.toggle("is-on", x === b); });
    state.cat = b.dataset.cat;
    renderTable();
    track("table_filter", { cat: state.cat });
  });
  $(".sort").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sort]");
    if (!b) return;
    $$(".sort [data-sort]").forEach(function (x) { x.classList.toggle("is-on", x === b); });
    state.sort = b.dataset.sort;
    renderTable();
    track("table_sort", { by: state.sort });
  });
  $("#etfs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-unlock]");
    if (!b) return;
    track("locked_click", { ticker: b.dataset.unlock });
    focusForm($('.lead[data-loc="final"]'));
  });

  $$(".faq details").forEach(function (d, i) {
    d.addEventListener("toggle", function () { if (d.open) track("faq_open", { q: i + 1 }, { once: "faq" + i }); });
  });

  // ---------------------------------------------------------------- forms
  var DOMAINS = ["seznam.cz", "gmail.com", "email.cz", "centrum.cz", "post.cz", "volny.cz", "atlas.cz", "outlook.com", "hotmail.com", "icloud.com", "yahoo.com", "outlook.cz", "tiscali.cz"];
  function lev(a, b) {
    var m = [], i, j;
    for (i = 0; i <= b.length; i++) m[i] = [i];
    for (j = 0; j <= a.length; j++) m[0][j] = j;
    for (i = 1; i <= b.length; i++) for (j = 1; j <= a.length; j++)
      m[i][j] = Math.min(m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1), m[i][j - 1] + 1, m[i - 1][j] + 1);
    return m[b.length][a.length];
  }
  function suggest(email) {
    var at = email.lastIndexOf("@");
    if (at < 1) return null;
    var dom = email.slice(at + 1);
    if (DOMAINS.indexOf(dom) > -1) return null;
    var best = null, bd = 3;
    DOMAINS.forEach(function (k) { var x = lev(dom, k); if (x < bd) { bd = x; best = k; } });
    return best ? email.slice(0, at + 1) + best : null;
  }
  var RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function focusForm(form) {
    if (!form || form.offsetParent === null) form = $('.lead[data-loc="final"]');
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    var input = $(".lead__input", form);
    if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, 450);
  }

  function setError(form, html) {
    var box = $(".lead__error", form);
    var input = $(".lead__input", form);
    if (!html) { box.hidden = true; input.removeAttribute("aria-invalid"); return; }
    box.innerHTML = html;
    box.hidden = false;
    input.setAttribute("aria-invalid", "true");
  }

  $$("form.lead").forEach(function (form) {
    var loc = form.dataset.loc;
    var input = $(".lead__input", form);
    var btn = $("button[type=submit]", form);
    var typoShownFor = null;

    input.addEventListener("focus", function () { track("form_start", { loc: loc }, { once: "form_start" }); track("form_focus", { loc: loc }, { once: "focus:" + loc }); });
    input.addEventListener("input", function () { setError(form, null); });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = input.value.trim().toLowerCase();
      if (!email) { setError(form, "Zadejte e-mail, ať máme kam tahák poslat."); track("form_error", { loc: loc, type: "empty" }); return; }
      if (!RE.test(email)) { setError(form, "Tohle nevypadá jako e-mail. Zkontrolujte prosím zavináč a doménu."); track("form_error", { loc: loc, type: "invalid" }); return; }
      var s = suggest(email);
      if (s && typoShownFor !== email) {
        typoShownFor = email;
        setError(form, 'Nemysleli jste <button type="button" data-fix="' + esc(s) + '">' + esc(s) + "</button>? Pokud ne, odešlete znovu.");
        $("[data-fix]", form).addEventListener("click", function () {
          input.value = s; setError(form, null); track("typo_accepted", { loc: loc }); input.focus();
        });
        track("form_error", { loc: loc, type: "typo_suggested" });
        return;
      }
      if ($(".hp", form).value) return; // bot

      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = "Odesílám…";
      track("form_submit", { loc: loc });
      var sess = window.trackSession ? window.trackSession() : {};

      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, loc: loc, sid: sess.sid, ctx: sess.ctx, t: sess.t, calc: state.calc, company: "" }),
      })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function (j) {
          state.leadId = j.id;
          try { localStorage.setItem("lead", j.id || "1"); } catch (e) {}
          track("lead_submitted", { loc: loc, time_to_lead_s: Math.round(sess.t || 0), loss: state.calc.loss });
          success(form, email, j);
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = label;
          var type = err && err.error === "invalid_email" ? "invalid" : "server";
          setError(form, type === "invalid" ? "Tenhle e-mail neumíme ověřit. Zkuste jiný." : "Něco se pokazilo na naší straně. Zkuste to prosím znovu.");
          track("form_error", { loc: loc, type: type });
        });
    });
  });

  function success(form, email, res) {
    var tpl = $("#tpl-done").content.cloneNode(true);
    var panel = $(".done", tpl);
    var pdf = $("[data-pdf]", panel);
    pdf.href = C.pdfUrl || pdf.getAttribute("href");
    pdf.addEventListener("click", function () { track("pdf_download", { from: "done" }); });
    $("[data-mail-msg]", panel).textContent = res.emailed
      ? "Kopie míří na " + email + ". Kdyby nedorazila, mrkněte do složky Hromadné nebo Spam."
      : "Odkaz na tahák vám pošleme i na " + email + ".";

    $$("[data-answer]", panel).forEach(function (b) {
      b.addEventListener("click", function () {
        var a = b.dataset.answer;
        $$("[data-answer]", panel).forEach(function (x) { x.classList.toggle("is-on", x === b); });
        track("profile_answer", { answer: a });
        fetch("/api/lead", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: state.leadId, profile: { monthly: a } }) }).catch(function () {});
        $("[data-profile]", panel).hidden = true;
        $("[data-profile-thanks]", panel).hidden = false;
      });
    });

    var shareUrl = location.origin + "/?utm_source=share&utm_medium=referral&utm_content=" + document.documentElement.dataset.v;
    var wa = $('[data-share="whatsapp"]', panel);
    wa.href = "https://wa.me/?text=" + encodeURIComponent("Tohle se ti bude hodit, americká ETF a čím je nahradit z Česka: " + shareUrl);
    wa.addEventListener("click", function () { track("share", { channel: "whatsapp" }); });
    $('[data-share="copy"]', panel).addEventListener("click", function (e) {
      var b = e.currentTarget;
      (navigator.clipboard ? navigator.clipboard.writeText(shareUrl) : Promise.reject()).then(function () { b.textContent = "Zkopírováno ✓"; }, function () { b.textContent = shareUrl; });
      track("share", { channel: "copy" });
    });

    form.replaceWith(panel);
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    track("thank_you_view", {});

    // the other forms on the page become a short "you already have it"
    $$("form.lead").forEach(function (f) { replaceWithGotIt(f); });
    $$(".ask-late").forEach(function (el) { el.hidden = true; });

    state.unlocked = true;
    renderTable(true);
    hideSticky(true);
  }

  function replaceWithGotIt(f) {
    var p = document.createElement("p");
    p.className = "got-it";
    p.innerHTML = 'Tahák už máte ✓ <a href="' + esc(C.pdfUrl) + '" download>Stáhnout znovu</a>';
    p.querySelector("a").addEventListener("click", function () { track("pdf_download", { from: "got_it" }); });
    f.replaceWith(p);
  }

  // Returning visitor who already gave us the email: don't ask again.
  if (state.unlocked) {
    $$("form.lead").forEach(replaceWithGotIt);
    $$(".ask-late").forEach(function (el) { el.hidden = true; });
  }

  // ---------------------------------------------------------------- sticky CTA
  var sticky = $(".sticky");
  var formsInView = 0;
  var stickyOff = state.unlocked;
  function updateSticky() {
    if (stickyOff) { sticky.hidden = true; return; }
    var show = scrollY > innerHeight * 0.9 && formsInView === 0;
    sticky.hidden = false;
    sticky.classList.toggle("is-shown", show);
    if (show) track("sticky_shown", {}, { once: "sticky" });
  }
  function hideSticky(off) { stickyOff = off; updateSticky(); }
  if ("IntersectionObserver" in window) {
    var fo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target._in = e.isIntersecting;
        if (e.isIntersecting) track("form_view", { loc: e.target.dataset.loc }, { once: "form_view:" + e.target.dataset.loc });
      });
      formsInView = $$("form.lead").filter(function (f) { return f._in; }).length;
      updateSticky();
    }, { threshold: 0.25 });
    $$("form.lead").forEach(function (f) { if (f.offsetParent !== null) fo.observe(f); });
  }
  addEventListener("scroll", updateSticky, { passive: true });
  sticky.addEventListener("click", function (e) {
    e.preventDefault();
    focusForm($('.lead[data-loc="final"]'));
  });

  // footer operator line
  var op = $("[data-operator]");
  if (op) op.textContent = C.operator || "";
})();
