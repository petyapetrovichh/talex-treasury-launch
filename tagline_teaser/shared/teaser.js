// Shared builder for both formats. Reads window.TEASER (timeline.js) and the
// root's data-layout ("horizontal" | "vertical"); only the text layout differs.
// Each index.html registers the returned timeline on window.__timelines.
window.buildTeaser = function (tl) {
  const T = window.TEASER;
  const root = document.querySelector("[data-composition-id]");
  const layout = root.dataset.layout;
  const W = Number(root.dataset.width);
  const margin = Number(root.dataset.safeMargin);
  const [LINE1, LINE2, LINE3] = T.lines;

  // Events sit a quarter frame before their frame boundary so each one is
  // guaranteed to land on exactly frame f (the same frame its sound starts).
  const at = (f) => (f - 0.25) / T.fps;

  const text = document.getElementById("text");
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  };
  const makeLine = () => text.appendChild(el("div", "line"));
  const makeCursor = (parent) => {
    const c = parent.appendChild(el("span", "cursor"));
    c.appendChild(el("i"));
    return c;
  };
  const chars = (parent, str, cls) =>
    Array.from(str).map((ch) => parent.appendChild(el("span", "ch " + cls, ch)));
  // The dots live in a zero-width box: they blink after "Businesses" without
  // pushing the centered text, and carry their own cursor.
  const makeDots = (parent) => {
    const box = parent.appendChild(el("span", "dots"));
    return { dots: chars(box, "...", "green"), cursor: makeCursor(box) };
  };

  // --- build DOM -----------------------------------------------------------
  // Every typed glyph starts display:none, so the visible string's width grows
  // one glyph at a time while its line stays centered (centered typewriter).
  let a1, a2, b, breakA, breakB, dotsUI, active;
  if (layout === "horizontal") {
    const line = makeLine();
    a1 = chars(line, LINE1, "white");
    breakA = chars(line, " ", "white")[0];
    a2 = chars(line, LINE2, "white");
    dotsUI = makeDots(line);
    breakB = chars(line, " ", "green")[0];
    b = chars(line, LINE3, "green");
    const main = makeCursor(line);
    active = (f) => (f >= T.dots[0] && f < T.deletes[2] ? dotsUI.cursor : main);
  } else {
    const [l1, l2, l3] = [makeLine(), makeLine(), makeLine()];
    a1 = chars(l1, LINE1, "white");
    const c1 = makeCursor(l1);
    a2 = chars(l2, LINE2, "white");
    dotsUI = makeDots(l2);
    const c2 = makeCursor(l2);
    b = chars(l3, LINE3, "green");
    const c3 = makeCursor(l3);
    active = (f) =>
      f < T.typeA[T.splitA] ? c1
      : f < T.dots[0] ? c2
      : f < T.deletes[2] ? dotsUI.cursor
      : f < T.typeB[0] ? c2
      : c3;
  }
  const cursors = Array.from(text.querySelectorAll(".cursor"));

  // --- auto-fit font size: largest size where every line fits the margins ---
  // Dots overflow to the right of a centered line, so they count twice.
  const measure = document.getElementById("measure");
  const widthOf = (s) => measure.appendChild(el("span", "", s)).getBoundingClientRect().width;
  function fit() {
    measure.textContent = "";
    const dotsW = widthOf("...");
    const widths =
      layout === "horizontal"
        ? [widthOf(LINE1 + " " + LINE2 + " " + LINE3), widthOf(LINE1 + " " + LINE2) + 2 * dotsW]
        : [widthOf(LINE1), widthOf(LINE2) + 2 * dotsW, widthOf(LINE3)];
    const px = Math.floor(((100 * (W - 2 * margin)) / Math.max(...widths)) * 2) / 2;
    root.style.setProperty("--fs", px + "px");
    root.dataset.fitPx = String(px);
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  // --- timeline ------------------------------------------------------------
  const show = (n, f) => tl.set(n, { display: "inline" }, at(f));
  const hide = (n, f) => tl.set(n, { display: "none" }, at(f));

  // 1) main phrase
  T.typeA.forEach((f, i) => {
    if (i < T.splitA) show(a1[i], f);
    else if (i === T.splitA) { if (breakA) show(breakA, f); }
    else show(a2[i - T.splitA - 1], f);
  });

  // 2) dots typed, cursor blinks twice, dots erased (last one first)
  T.dots.forEach((f, k) => show(dotsUI.dots[k], f));
  T.deletes.forEach((f, k) => hide(dotsUI.dots[2 - k], f));

  // 3) final phrase
  T.typeB.forEach((f, i) => {
    if (i === 0) { if (breakB) show(breakB, f); }
    else show(b[i - 1], f);
  });

  // 4) cursor: iOS-style blink while idle, solid while typing. At every
  //    change point only the active cursor may be visible.
  const onAt = (f) => T.cursor.reduce((on, [g, v]) => (g <= f ? v : on), 0);
  const changes = new Set(T.cursor.map(([g]) => g));
  [T.typeA[T.splitA], T.dots[0], T.deletes[2], T.typeB[0]].forEach((g) => changes.add(g));
  cursors.forEach((c) => tl.set(c, { opacity: 0 }, 0));
  [...changes].sort((x, y) => x - y).forEach((f) => {
    const cur = active(f);
    const on = onAt(f);
    cursors.forEach((c) => tl.set(c, { opacity: c === cur && on ? 1 : 0 }, f === 0 ? 0 : at(f)));
  });

  // 5) hard cut to black -> soft logo fade-in, synced with the boom
  tl.set("#text-scene", { opacity: 0 }, at(T.cut));
  tl.fromTo("#logo", { opacity: 0 }, { opacity: 1, duration: T.logoFade / T.fps, ease: "power1.out" }, at(T.logo));
  tl.set({}, {}, T.end / T.fps);
  return tl;
};
