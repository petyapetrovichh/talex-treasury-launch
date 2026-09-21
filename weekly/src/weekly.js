/* Shared, browser-side helpers for the TaleX weekly composition.
 * Reads window.WEEK_DATA (written by scripts/weekly.mjs from data/week.json)
 * and derives every display value. Nothing here is hardcoded to a week. */
(function () {
  var D = window.WEEK_DATA;
  if (!D) throw new Error("WEEK_DATA missing: run `npm run weekly` (or prepare-data) to build data/week.js");

  var nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  function int(n) { return nf0.format(Math.round(n)); }
  function usd(n) { return "$" + int(n); }
  function fixed(n, d) {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  }
  function shortTx(h) {
    h = String(h || "");
    return h.length > 12 ? h.slice(0, 6) + "…" + h.slice(-4) : h;
  }
  function kFormat(n) {
    if (n >= 1000) {
      var k = n / 1000;
      var s = k >= 100 ? k.toFixed(0) : k.toFixed(1);
      if (s.endsWith(".0")) s = s.slice(0, -2);
      return s + "K";
    }
    return String(Math.round(n));
  }
  var holders = D.holders || [];
  var first = holders.length ? holders[0].value : 0;
  var last = holders.length ? holders[holders.length - 1].value : 0;
  var growthPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  var netChange = last - first;
  function signed(n, fmt) { return (n >= 0 ? "+" : "−") + fmt(Math.abs(n)); }

  window.Weekly = {
    data: D,
    schedule: D.schedule,
    format: document.documentElement.getAttribute("data-format") || "square",
    isPortrait: document.documentElement.getAttribute("data-format") === "portrait",
    isLandscape: document.documentElement.getAttribute("data-format") === "landscape",
    fmt: { int: int, usd: usd, fixed: fixed, shortTx: shortTx, k: kFormat, signed: signed },
    derived: {
      buybackUsd: usd(D.buyback_usd),
      cumulativeUsd: usd(D.cumulative_usd),
      xInjected: int(D.x_injected),
      bnbInjected: fixed(D.bnb_injected, 3),
      priceUsd: "$" + fixed(D.price_usd, 4),
      revenuePct: int(D.revenue_pct) + "%",
      txShort: shortTx(D.tx_hash),
      weekLabel: "Week #" + int(D.week),
      holdersFirst: first,
      holdersLast: last,
      growthPct: growthPct,
      growthLabel: signed(growthPct, function (n) { return n + "%"; }),
      netChange: netChange,
      netChangeLabel: signed(netChange, int),
    },
  };
})();
