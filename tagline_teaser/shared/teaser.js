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
  const makeCursor = (line) => {
    const c = line.appendChild(el("span", "cursor"));
    c.appendChild(el("i"));
    return c;
  };
  const chars = (line, str, cls) =>
    Array.from(str).map((ch) => line.appendChild(el("span", "ch " + cls, ch)));

  // --- build DOM -----------------------------------------------------------
  // Every typed glyph starts display:none, so the visible string's width grows
  // one glyph at a time while its line stays centered (centered typewriter).
  let a1, a2, dots, b, breakA, breakB, cursorForA2, cursorForB;
  const cursors = [];
  if (layout === "horizontal") {
    const line = makeLine();
    a1 = chars(line, LINE1, "white");
    breakA = chars(line, " ", "white")[0];
    a2 = chars(line, LINE2, "white");
    dots = chars(line, "...", "green");
    breakB = chars(line, " ", "green")[0];
    b = chars(line, LINE3, "green");
    cursors.push(makeCursor(line));
    cursorForA2 = cursorForB = cursors[0];
  } else {
    const [l1, l2, l3] = [makeLine(), makeLine(), makeLine()];
    a1 = chars(l1, LINE1, "white");
    cursors.push(makeCursor(l1));
    a2 = chars(l2, LINE2, "white");
    dots = chars(l2, "...", "green");
    cursors.push(makeCursor(l2));
    b = chars(l3, LINE3, "green");
    cursors.push(makeCursor(l3));
    cursorForA2 = cursors[1];
    cursorForB = cursors[2];
  }

  // --- auto-fit font size: largest size where the longest final line fits ---
  const finalLines =
    layout === "horizontal"
      ? [LINE1 + " " + LINE2 + "... " + LINE3]
      : [LINE1, LINE2 + "...", LINE3];
  const measure = document.getElementById("measure");
  function fit() {
    measure.textContent = "";
    const widths = finalLines.map((s) => {
      const m = measure.appendChild(el("span", "", s));
      return m.getBoundingClientRect().width;
    });
    const px = Math.floor((100 * (W - 2 * margin)) / Math.max(...widths) * 2) / 2;
    root.style.setProperty("--fs", px + "px");
    root.dataset.fitPx = String(px);
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  // --- timeline ------------------------------------------------------------
  const show = (n, f) => tl.set(n, { display: "inline" }, at(f));
  const hide = (n, f) => tl.set(n, { display: "none" }, at(f));
  const cursorOn = (c, on, f) => tl.set(c, { opacity: on ? 1 : 0 }, at(f));

  cursors.forEach((c) => tl.set(c, { opacity: 0 }, 0));

  // 1) cursor blink x2 (on/off/on/off), then solid as typing starts
  const B = T.blink;
  for (let k = 0; k < B.count * 2; k++) cursorOn(cursors[0], k % 2 === 0, B.start + k * B.state);
  cursorOn(cursors[0], true, T.typeA[0]);

  // 2) main phrase
  T.typeA.forEach((f, i) => {
    if (i < T.splitA) show(a1[i], f);
    else if (i === T.splitA) {
      if (breakA) show(breakA, f);
      if (cursorForA2 !== cursors[0]) { cursorOn(cursors[0], false, f); cursorOn(cursorForA2, true, f); }
    } else show(a2[i - T.splitA - 1], f);
  });

  // 3) loading dots: build, clear, build again and settle
  T.dots.forEach((loop) => {
    loop.on.forEach((f, k) => show(dots[k], f));
    if (loop.off !== null) dots.forEach((d) => hide(d, loop.off));
  });

  // 4) final phrase
  T.typeB.forEach((f, i) => {
    if (i === 0) {
      if (breakB) show(breakB, f);
      if (cursorForB !== cursorForA2) { cursorOn(cursorForA2, false, f); cursorOn(cursorForB, true, f); }
    } else show(b[i - 1], f);
  });

  // 5) hold -> cursor gone -> hard cut to black -> logo cut-in
  cursorOn(cursorForB, false, T.cursorHide);
  tl.set("#text-scene", { opacity: 0 }, at(T.cut));
  tl.set("#logo", { opacity: 1 }, at(T.logo));
  tl.set({}, {}, T.end / T.fps);
  return tl;
};
