// Math and data tests for True Size Screens. No browser needed: it copies the app's own functions out of
// index.html (see lib/app.js) and checks them against values worked out by hand, not with the app's formulas.
//
//   node tests/unit.js
//
// Most fixtures use whole-number triangles so the right answer is easy to check on paper. For example a
// 13-inch screen of 1200 × 500 pixels has the 5-12-13 shape, so it is exactly 12 × 5 inches at 100 pixels per inch.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load, ROOT, html } = require("./lib/app");
const { check, section, near, close, finish } = require("./lib/check");

const S = { orient: "landscape", units: "in", video: "16:9", ebookPt: 12, ebookCols: "1", siteLayout: "auto", fit: "page" };
const app = load(["geom", "aspectLabel", "fmtLen", "pageFit", "spreadOf", "videoFit", "VIDEOS", "dprOf", "siteView", "parseCsv", "slug", "catKey", "CATS", "sizeTag"], { S });
const { geom, aspectLabel, pageFit, spreadOf, videoFit, dprOf, siteView } = app;
const withS = (patch, fn) => { const old = { ...S }; Object.assign(S, patch); try { return fn(); } finally { Object.assign(S, old); } };

// Hand-checked screens
const TRI = { n: "5-12-13 test screen", c: "custom", d: 13, w: 1200, h: 500 };      // 12 × 5 in, 100 ppi, 60 sq in
const FOUR3 = { n: "4:3 test screen", c: "custom", d: 10, w: 2000, h: 1500 };      // 8 × 6 in, 250 ppi, 48 sq in
const FOUR3_LOW = { n: "same size, fewer pixels", c: "custom", d: 10, w: 800, h: 600 }; // 8 × 6 in, 100 ppi
const HD = { n: "16:9 test screen", c: "custom", d: Math.hypot(16, 9), w: 1920, h: 1080 }; // 16 × 9 in, 120 ppi
const IPAD13 = { n: "iPad Pro 13-inch (M4/M5)", c: "tablet", d: 13, w: 2752, h: 2064 }; // 3-4-5 shape: 10.4 × 7.8 in, 3440 / 13 ppi

// ---------------------------------------------------------------------------------------------------------
section("Physical geometry");
{
  const g = withS({ orient: "landscape" }, () => geom(TRI));
  check("5-12-13 screen is 12 × 5 in at 100 ppi", near(g.w, 12) && near(g.h, 5) && near(g.ppi, 100), JSON.stringify(g));
  check("its area is 60 sq in", near(g.area, 60));
  const f = withS({ orient: "landscape" }, () => geom(FOUR3));
  check("4:3 10-inch screen is 8 × 6 in at 250 ppi, 48 sq in", near(f.w, 8) && near(f.h, 6) && near(f.ppi, 250) && near(f.area, 48));
  const ip = withS({ orient: "landscape" }, () => geom(IPAD13));
  check("iPad Pro 13 (2752 × 2064, 13 in) is 10.4 × 7.8 in at 264.6 ppi", near(ip.w, 10.4, 1e-9) && near(ip.h, 7.8, 1e-9) && near(ip.ppi, 3440 / 13, 1e-9));

  // Internal consistency for every built-in screen
  const rows = app.parseCsv(fs.readFileSync(path.join(ROOT, "devices.csv"), "utf8"));
  rows.shift();
  const devs = rows.filter(r => r[1] !== "paper").map(r => ({ n: r[0], c: r[1], d: +r[2], w: Math.max(+r[3], +r[4]), h: Math.min(+r[3], +r[4]) }));
  const bad = [];
  for (const d of devs) for (const orient of ["landscape", "portrait"]) {
    const g = withS({ orient }, () => geom(d));
    const ok = close(Math.hypot(g.w, g.h), d.d, 1e-9)              // diagonal matches the spec sheet
      && close(g.w / g.h, g.pxW / g.pxH, 1e-9)                       // physical shape matches the pixel shape
      && close(g.ppi * g.w, g.pxW, 1e-9) && close(g.ppi * g.h, g.pxH, 1e-9) // pixels = inches × ppi on both axes
      && close(g.area, g.w * g.h, 1e-9)
      && close(g.ppi, Math.hypot(d.w, d.h) / d.d, 1e-12);
    if (!ok) bad.push(d.n + " " + orient);
  }
  check(`diagonal, aspect ratio, area and PPI agree for all ${devs.length} built-in screens`, bad.length === 0, bad.slice(0, 3).join(", "));

  const rot = [];
  for (const d of devs) {
    const L = withS({ orient: "landscape" }, () => geom(d)), P = withS({ orient: "portrait" }, () => geom(d));
    const F = withS({ orient: "landscape" }, () => geom(d, true)); // one screen turned on its own
    if (!(L.w === P.h && L.h === P.w && L.pxW === P.pxH && L.pxH === P.pxW && L.area === P.area && L.ppi === P.ppi && F.w === P.w && F.h === P.h)) rot.push(d.n);
  }
  check("rotating swaps width and height and keeps diagonal, area and PPI (all screens)", rot.length === 0, rot.slice(0, 3).join(", "));
  const inch = withS({ units: "in" }, () => geom(TRI)), cm = withS({ units: "cm" }, () => geom(TRI));
  check("switching to centimeters doesn't change the geometry", JSON.stringify(inch) === JSON.stringify(cm));
  check("lengths show as inches or centimeters", withS({ units: "in" }, () => app.fmtLen(12)) === "12.00″" && withS({ units: "cm" }, () => app.fmtLen(12)) === "30.5 cm");
  const twin = { ...TRI, n: "another name" };
  check("identical displays have identical measurements", JSON.stringify(geom(TRI)) === JSON.stringify(geom(twin)));
  const lo = withS({ orient: "landscape" }, () => geom(FOUR3_LOW));
  check("same diagonal and shape with fewer pixels: same size, lower PPI", lo.w === f.w && lo.h === f.h && near(lo.ppi, 100));
  const shape = withS({ orient: "landscape" }, () => geom({ n: "aspect only", c: "custom", d: 13, w: 12, h: 5, aspectOnly: true }));
  check("a screen entered as an aspect ratio has a size but no PPI", near(shape.w, 12) && near(shape.h, 5) && shape.ppi === null);
  check("aspect labels: 16:9, 4:3, 16:10, 3:2, 21:9, √2", aspectLabel(1920, 1080) === "16:9" && aspectLabel(2752, 2064) === "4:3" && aspectLabel(2560, 1600) === "16:10"
    && aspectLabel(2880, 1920) === "3:2" && aspectLabel(3440, 1440) === "21:9 (ultrawide)" && aspectLabel(11.693, 8.268) === "√2 (like A4)", aspectLabel(3440, 1440));
}

// ---------------------------------------------------------------------------------------------------------
section("Video");
{
  const vid = (dev, video, orient = "landscape", flip) => withS({ video, orient }, () => { const g = geom(dev, flip); return { g, v: videoFit(g) }; });
  let { g, v } = vid(HD, "16:9");
  check("16:9 video on a 16:9 screen fills it: no bars", near(v.used, 1) && near(v.barsTB, 0) && near(v.barsLR, 0) && near(v.vw, 16) && near(v.vh, 9));
  ({ v } = vid(FOUR3, "16:9"));
  check("16:9 on a 4:3 screen (8 × 6 in): 8 × 4.5 in picture, 0.75 in bars top and bottom, 75% used", near(v.vw, 8) && near(v.vh, 4.5) && near(v.barsTB, 0.75) && near(v.barsLR, 0) && near(v.used, 0.75));
  ({ g, v } = vid(HD, "4:3"));
  check("4:3 on a 16:9 screen (16 × 9 in): 12 × 9 in picture, 2 in bars left and right", near(v.vw, 12) && near(v.vh, 9) && near(v.barsLR, 2) && near(v.barsTB, 0) && near(v.used, 0.75));
  check("4:3 picture uses 1440 × 1080 of the screen's pixels", Math.round(v.vw * g.ppi) === 1440 && Math.round(v.vh * g.ppi) === 1080);
  ({ v } = vid(HD, "2.39:1"));
  check("2.39:1 cinema on 16:9: 16 × 6.69 in picture, 1.15 in bars", near(v.vh, 16 / 2.39, 1e-9) && near(v.barsTB, (9 - 16 / 2.39) / 2, 1e-9) && near(v.barsTB, 1.1527, 1e-4));
  ({ v } = vid(FOUR3, "9:16"));
  check("9:16 vertical video on a landscape 8 × 6 in screen: 3.375 in wide, 2.3125 in bars each side", near(v.vh, 6) && near(v.vw, 3.375) && near(v.barsLR, 2.3125));
  ({ v } = vid(HD, "16:9", "portrait"));
  check("turning a 16:9 screen upright letterboxes 16:9 video to 9 × 5.06 in (31.6%)", near(v.vw, 9) && near(v.vh, 81 / 16) && near(v.used, 81 / 256) && near(v.barsTB, (16 - 81 / 16) / 2));
  ({ v } = vid(HD, "9:16", "portrait"));
  check("and makes 9:16 video fill it", near(v.used, 1));
  ({ v } = vid(HD, "16:9", "landscape", true));
  check("one screen turned on its own behaves the same as all screens upright", near(v.vw, 9) && near(v.used, 81 / 256));
  const all = [];
  for (const [id] of app.VIDEOS) for (const dev of [TRI, FOUR3, HD, IPAD13]) for (const o of ["portrait", "landscape"]) {
    const { g, v } = vid(dev, id, o);
    const ok = close(v.vw / v.vh, v.ar, 1e-9) && v.vw <= g.w + 1e-9 && v.vh <= g.h + 1e-9 && (near(v.vw, g.w, 1e-9) || near(v.vh, g.h, 1e-9))
      && near(v.used, v.vw * v.vh / (g.w * g.h), 1e-12) && near(v.vw + 2 * v.barsLR, g.w, 1e-9) && near(v.vh + 2 * v.barsTB, g.h, 1e-9);
    if (!ok) all.push(`${id} ${dev.n} ${o}`);
  }
  check("every video shape: picture keeps its shape, touches two edges, bars and area add up", all.length === 0, all.slice(0, 3).join(", "));
}

// ---------------------------------------------------------------------------------------------------------
section("E-book");
// The real layout code, fed a stand-in for the browser's font measuring (canvas isn't available in Node).
// Synthetic text: one long paragraph of four-letter words, each exactly 2 em wide, 0.25 em spaces.
const ebookApp = (words, space = 0.25) => load(["ebookFit", "layoutEbook", "EBOOK_MARGIN", "EBOOK_GAP", "EBOOK_INDENT", "EBOOK_LAYOUTS", "AUSTEN"], { S, FAKE_TEXT: { words, space, cap: 0.7, xh: 0.47 } },
  "function ebookText() { return FAKE_TEXT; }");
const synth = Array.from({ length: 5000 }, (_, k) => ({ t: "aaaa", w: 2, p: k === 0, e: k === 4999 }));
const E = ebookApp(synth);
{
  const fit = (g, pt, cols = "1") => withS({ ebookPt: pt }, () => E.ebookFit(g, cols));
  const a = fit({ w: 6, h: 8 }, 12);
  // 12 pt = 1/6 in. 1.5 line spacing = 0.25 in. 8 in minus 0.3 in margins = 7.4 in → 29 lines.
  // Line width 5.4 in = 32.4 em: 13 words on the indented first line, 14 on the others → 13 + 28 × 14 = 405 words.
  check("6 × 8 in screen at 12 pt: 29 lines of 32.4 em", a.lines === 29 && near(a.tw / a.em, 32.4, 1e-9), `${a.lines} lines, ${a.tw / a.em} em`);
  check("holds 405 words (counted by hand)", a.words === 405, a.words);
  check("about 69 characters per line", a.cpl === 69, a.cpl);
  const b = fit({ w: 12, h: 8 }, 12, "2");
  check("two columns on 12 × 8 in: 32.7 em each, 811 words", b.cols === 2 && near(b.tw / b.em, 32.7, 1e-9) && b.words === 811, `${b.cols} cols, ${b.words} words`);

  const devFit = (dev, pt, cols) => fit(withS({ orient: "portrait" }, () => geom(dev)), pt, cols);
  const hi = devFit(FOUR3, 12), lo = devFit(FOUR3_LOW, 12);
  check("same physical size, different PPI (250 vs 100): same text capacity", hi.words === lo.words && hi.lines === lo.lines && hi.cpl === lo.cpl, `${hi.words} vs ${lo.words}`);
}
{
  // Real passage (Pride and Prejudice) with a fixed-width stand-in font: 0.5 em per character
  const words = [];
  const R = ebookApp([]);
  R.AUSTEN.forEach(par => par.split(" ").forEach((t, k, a) => words.push({ t, w: t.length * 0.5, p: k === 0, e: k === a.length - 1 })));
  const A = ebookApp(words);
  const PTS = [8, 10, 12, 14, 16, 18, 20, 24, 28];
  const csv = app.parseCsv(fs.readFileSync(path.join(ROOT, "devices.csv"), "utf8")); csv.shift();
  const devs = csv.filter(r => r[1] !== "paper").map(r => ({ n: r[0], c: r[1], d: +r[2], w: Math.max(+r[3], +r[4]), h: Math.min(+r[3], +r[4]) }));
  const fit = (g, pt, cols) => withS({ ebookPt: pt }, () => A.ebookFit(g, cols));
  const grows = [], autoGrows = [], agree = [], start = [], widths = [], autoPick = [];
  for (const d of devs) for (const orient of ["portrait", "landscape"]) {
    const g = withS({ orient }, () => geom(d));
    for (const cols of ["1", "2", "auto"]) {
      let prev = Infinity;
      for (const pt of PTS) {
        const e = fit(g, pt, cols);
        if (e.words > prev) (cols === "auto" ? autoGrows : grows).push(`${d.n} ${orient} ${cols} at ${pt} pt: ${prev} → ${e.words}`);
        prev = e.words;
        if (pt !== 12) continue;
        // the counted words are exactly the words laid out in the lines that get drawn
        const flat = e.lay.cols.flat();
        const n = flat.reduce((s, l) => s + (l.text ? l.text.split(" ").length : 0), 0);
        // (a column too narrow for even one letter is left empty: no lines, no words)
        const empty = e.tw / e.em <= 1 && e.words === 0 && e.lay.cols.length === 0;
        if (n !== e.words || (!empty && (e.lay.cols.length !== e.cols || e.lay.cols.some(c => c.length !== e.lines)))) agree.push(`${d.n} ${orient} ${cols}`);
        // no line is wider than the column, unless it holds a single long word
        if (flat.some(l => l.ind + l.w > e.tw / e.em + 1e-9 && l.text.includes(" "))) widths.push(`${d.n} ${orient} ${cols}`);
        // every screen starts at the same word and reads on in order
        const text = flat.map(l => l.text).join(" ").split(" ").filter(Boolean);
        if (e.words && text.some((t, k) => t !== words[k % words.length].t)) start.push(`${d.n} ${orient} ${cols}`);
        if (cols === "auto") {
          const off = c => c < 45 ? 45 - c : c > 75 ? c - 75 : 0;
          const one = fit(g, 12, "1"), two = fit(g, 12, "2");
          const want = off(two.cpl) < off(one.cpl) ? 2 : 1;
          if (e.cols !== want || e.words !== (want === 2 ? two : one).words) autoPick.push(`${d.n} ${orient}`);
        }
      }
    }
  }
  check("bigger text never fits more words (1 and 2 columns, all screens, 8–28 pt)", grows.length === 0, grows.slice(0, 2).join("; "));
  check("word count equals the words in the drawn lines; lines per column match", agree.length === 0, agree.slice(0, 3).join(", "));
  check("no line is wider than its column", widths.length === 0, widths.slice(0, 3).join(", "));
  check("every screen starts at the same first word of the same passage, in order", start.length === 0 && words[0].t === "Had", start.slice(0, 3).join(", "));
  check("Auto picks the column count whose line length is nearer 45–75 characters", autoPick.length === 0, autoPick.slice(0, 3).join(", "));
  // Auto can switch from 2 columns to 1 as the text grows, which drops the column gap and can fit a few more words.
  // That's expected, so it is reported here rather than counted as a failure.
  if (autoGrows.length) console.log(`  - note: in Auto, ${autoGrows.length} size steps fit slightly more words after switching to 1 column (e.g. ${autoGrows[0]})`);
  const wide = withS({ orient: "landscape" }, () => geom(IPAD13)), tall = withS({ orient: "portrait" }, () => geom({ n: "phone", c: "phone", d: 6.1, w: 2532, h: 1170 }));
  check("Auto: two columns on a landscape 13-inch tablet, one on a phone", fit(wide, 12, "auto").cols === 2 && fit(tall, 12, "auto").cols === 1);
  check("manual 1 and 2 columns are honored even when Auto would choose otherwise", fit(tall, 12, "2").cols === 2 && fit(wide, 12, "1").cols === 1);
}

// ---------------------------------------------------------------------------------------------------------
section("Calibration card");
{
  const cal = load(["CARD_MM", "CAL_UPRIGHT", "CAL_MIN", "CAL_MAX", "okCal", "ZOOM_MIN", "ZOOM_MAX"]);
  check("the calibration card is a standard bank card (ISO/IEC 7810 ID-1), 85.60 × 53.98 mm", cal.CARD_MM[0] === 85.6 && cal.CARD_MM[1] === 53.98);
  check("which is 3.3701 × 2.1252 in", near(cal.CARD_MM[0] / 25.4, 3.37008, 1e-5) && near(cal.CARD_MM[1] / 25.4, 2.12520, 1e-5));
  check("phones (150 to 165 px per inch) get the card upright: sideways it needs about 556 px", near(cal.CAL_UPRIGHT, 556.06, 0.01));
  check("saved calibrations are accepted only as numbers from 50 to 260", cal.okCal(50) && cal.okCal(132.5) && cal.okCal(260) && ![49.9, 260.5, "120", null, NaN, -5, Infinity].some(cal.okCal));
  check("the zoom slider reaches every calibrated actual-size scale", cal.ZOOM_MIN <= cal.CAL_MIN && cal.ZOOM_MAX >= cal.CAL_MAX);
  const slider = (id, html) => html.match(new RegExp(`id="${id}" type="range" min="(\\d+)" max="(\\d+)"`)).slice(1).map(Number);
  check("and the sliders in the page match those limits", JSON.stringify(slider("zoom", html)) === JSON.stringify([cal.ZOOM_MIN, cal.ZOOM_MAX]) && JSON.stringify(slider("cal-range", html)) === JSON.stringify([cal.CAL_MIN, cal.CAL_MAX]));
}

section("PDF page fit");
{
  const LETTER = { w: 8.5, h: 11 };
  const port = withS({ orient: "portrait" }, () => geom(TRI)), land = withS({ orient: "landscape" }, () => geom(TRI)); // 5 × 12 and 12 × 5 in
  let f = pageFit(port, LETTER, "page");
  check("Fit page, Letter on an upright 5 × 12 in screen: 58.8%, whole page visible", near(f.k, 5 / 8.5) && near(f.shown, 1));
  f = pageFit(land, LETTER, "page");
  check("Fit page on a 12 × 5 in screen: limited by height, 45.5%, whole page visible", near(f.k, 5 / 11) && near(f.shown, 1));
  f = pageFit(land, LETTER, "width");
  check("Fit width on 12 × 5 in: 141.2%, page width fills the screen, 32.2% of the page visible", near(f.k, 12 / 8.5) && near(8.5 * f.k, 12) && near(f.shown, 60 / (93.5 * (12 / 8.5) ** 2)) && near(f.shown, 0.32197, 1e-5));
  f = pageFit(port, LETTER, "actual");
  check("100% keeps printed size: 5 × 11 in of the 8.5 × 11 in page visible (58.8%)", f.k === 1 && near(f.shown, 55 / 93.5));
  f = pageFit(land, LETTER, "actual");
  check("100% on 12 × 5 in: 8.5 × 5 in visible (45.5%)", f.k === 1 && near(f.shown, 42.5 / 93.5));
  const two = spreadOf({ spread: true }, LETTER);
  check("two-page view is two pages wide", two.w === 17 && two.h === 11 && two.single === 8.5);
  f = pageFit(land, two, "page");
  check("two Letter pages on 12 × 5 in: Fit page is still limited by height (45.5%)", near(f.k, 5 / 11) && near(f.shown, 1));
  f = pageFit(port, two, "page");
  check("two Letter pages on 5 × 12 in: limited by width (29.4%)", near(f.k, 5 / 17) && near(f.shown, 1));
  const A4L = { w: 11.693, h: 8.268 };
  f = pageFit(land, A4L, "page");
  check("landscape A4 on 12 × 5 in: Fit page 60.5%", near(f.k, 5 / 8.268) && near(f.shown, 1));
  // Effective text size and pixels per page inch scale with the zoom factor
  const k = pageFit(land, LETTER, "width").k;
  check("12 pt text at 141.2% looks like 16.9 pt; 100 ppi screen gives 141 pixels per page inch", (12 * k).toFixed(1) === "16.9" && Math.round(land.ppi * k) === 141);
  // A cropped page (4.5 × 7 in of content) is fitted like a smaller page, but 100% stays at printed size
  const CROP = { w: 4.5, h: 7 };
  check("cropped page: Fit width zooms in by 8.5 ÷ 4.5", near(pageFit(port, CROP, "width").k / pageFit(port, LETTER, "width").k, 8.5 / 4.5));
  check("cropped page: Fit page uses the cropped size", near(pageFit(port, CROP, "page").k, Math.min(5 / 4.5, 12 / 7)));
  check("cropped page at 100% is still printed size", pageFit(port, CROP, "actual").k === 1);
  const vis = [];
  for (const g of [port, land, geom(FOUR3), geom(HD)]) for (const p of [LETTER, A4L, two, CROP]) for (const fit of ["page", "width", "actual"]) {
    const r = pageFit(g, p, fit);
    if (!(r.shown > 0 && r.shown <= 1 + 1e-12) || (fit === "page" && !near(r.shown, 1, 1e-12))) vis.push(`${fit} ${p.w}x${p.h} on ${g.w}x${g.h}`);
  }
  check("visible share is always between 0 and 100%, and 100% for Fit page", vis.length === 0, vis.join(", "));
}

// ---------------------------------------------------------------------------------------------------------
section("Crop white margins (content detection)");
{
  const C = load(["inkBox", "padBox", "clampBox", "pageBox", "CELL", "CROP_PAD"], { pdf: { w: 5, h: 7, typ: null } });
  // An RGBA image filled with one color, plus rectangles
  const img = (w, h, bg) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = bg[0]; d[i + 1] = bg[1]; d[i + 2] = bg[2]; d[i + 3] = 255; } return { d, w, h }; };
  const rect = (m, x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = (yy * m.w + xx) * 4; m.d[i] = c[0]; m.d[i + 1] = c[1]; m.d[i + 2] = c[2]; } return m; };
  const box = m => C.inkBox(m.d, m.w, m.h);
  const same = (b, e) => b && typeof b === "object" && ["x", "y", "w", "h"].every(k => near(b[k], e[k], 1e-9));
  const WHITE = [255, 255, 255], INK = [20, 20, 20], CREAM = [242, 239, 226];
  const want = { x: 0.25, y: 0.2, w: 0.5, h: 0.6 };
  let m = rect(img(400, 400, WHITE), 100, 80, 200, 240, INK);
  check("finds a text block at 25–75% across and 20–80% down", same(box(m), want), JSON.stringify(box(m)));
  m = rect(img(400, 400, CREAM), 100, 80, 200, 240, INK);
  check("works on off-white (cream) paper", same(box(m), want), JSON.stringify(box(m)));
  rect(m, 20, 20, 2, 2, INK); rect(m, 360, 370, 3, 3, INK);
  check("ignores specks of dust", same(box(m), want), JSON.stringify(box(m)));
  m = rect(rect(img(400, 400, WHITE), 100, 80, 200, 240, INK), 0, 0, 5, 400, [60, 60, 60]);
  check("ignores a scanner shadow along the edge", same(box(m), want), JSON.stringify(box(m)));
  m = rect(rect(img(400, 400, WHITE), 100, 80, 200, 240, INK), 140, 360, 40, 8, INK);
  check("keeps a page number below the text", same(box(m), { x: 0.25, y: 0.2, w: 0.5, h: 0.72 }), JSON.stringify(box(m)));
  m = rect(img(400, 400, WHITE), 100, 80, 200, 240, [225, 225, 225]);
  check("very faint marks (less than 40 levels from the paper) aren't content", box(m) === null, JSON.stringify(box(m)));
  check("a blank page has no content box", box(img(200, 300, WHITE)) === null);
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  m = img(200, 200, WHITE); for (let i = 0; i < m.d.length; i += 4) { m.d[i] = rnd() * 255; m.d[i + 1] = rnd() * 255; m.d[i + 2] = rnd() * 255; }
  check("a photo (no clear background) isn't cropped", box(m) === "full");
  // Safety margin: 0.12 in on each side of a 5 × 7 in page
  const p = C.padBox({ x: 0.2, y: 0.1, w: 0.6, h: 0.8 });
  check("adds a 0.12 in safety margin on every side", same(p, { x: 0.2 - 0.12 / 5, y: 0.1 - 0.12 / 7, w: 0.6 + 0.24 / 5, h: 0.8 + 0.24 / 7 }));
  const edge = C.padBox({ x: 0, y: 0.98, w: 1, h: 0.02 });
  check("the margin never reaches past the page edge", edge.x === 0 && edge.w === 1 && near(edge.y + edge.h, 1));
}

// ---------------------------------------------------------------------------------------------------------
section("Website previews");
{
  const site = (dev, orient = "portrait", layout = "auto") => withS({ orient, siteLayout: layout }, () => { const g = geom(dev); return { g, v: siteView(dev, g) }; });
  const IPHONE = { n: "iPhone 15", c: "phone", d: 6.1, w: 2556, h: 1179 };
  let { g, v } = site(IPHONE);
  check("iPhone: 3× scaling, 393 × 852 CSS px (Apple's published size)", v.dpr === 3 && v.vw === 393 && v.vh === 852, `${v.dpr} ${v.vw}×${v.vh}`);
  check("16 px text = 48 screen pixels = 7.5 pt print", close(v.bodyPt, 48 / g.ppi * 72, 1e-12) && v.bodyPt.toFixed(1) === "7.5");
  ({ v } = site(IPHONE, "landscape"));
  check("turning the phone sideways swaps the browser size to 852 × 393", v.vw === 852 && v.vh === 393);
  check("and switches to the tablet layout at 852 px wide", v.natural === "tablet");
  check("iPhone SE, XR and 11 use 2×; 11 Pro uses 3×", dprOf({ n: "iPhone SE (3rd generation)", c: "phone", d: 4.7, w: 1334, h: 750 }) === 2 && dprOf({ n: "iPhone 11", c: "phone", d: 6.1, w: 1792, h: 828 }) === 2
    && dprOf({ n: "iPhone XR", c: "phone", d: 6.1, w: 1792, h: 828 }) === 2 && dprOf({ n: "iPhone 11 Pro", c: "phone", d: 5.8, w: 2436, h: 1125 }) === 3);
  check("iPhone 4 and 4s use 2× (regression: device audit added them)", dprOf({ n: "iPhone 4s / iPhone 4", c: "phone", d: 3.5, w: 960, h: 640 }) === 2
    && dprOf({ n: "iPhone 14", c: "phone", d: 6.1, w: 2532, h: 1170 }) === 3 && dprOf({ n: "iPhone 8 Plus / 7 Plus", c: "phone", d: 5.5, w: 1920, h: 1080 }) === 3);
  // MacBooks: within 3% of Apple's default "looks like" sizes
  const mba = site({ n: "MacBook Air 13-inch", c: "laptop", d: 13.6, w: 2560, h: 1664 }, "landscape").v, mbp = site({ n: "MacBook Pro 14-inch", c: "laptop", d: 14.2, w: 3024, h: 1964 }, "landscape").v;
  check("MacBook Air 13.6: within 3% of Apple's 1470 × 956 default", Math.abs(mba.vw / 1470 - 1) < 0.03 && Math.abs(mba.vh / 956 - 1) < 0.03, `${mba.vw}×${mba.vh}`);
  check("MacBook Pro 14: within 3% of Apple's 1512 × 982 default", Math.abs(mbp.vw / 1512 - 1) < 0.03 && Math.abs(mbp.vh / 982 - 1) < 0.03, `${mbp.vw}×${mbp.vh}`);
  check("27-inch 4K monitor: 150% (Windows' recommendation)", dprOf({ n: "27\" 4K monitor", c: "monitor", d: 27, w: 3840, h: 2160 }) === 1.5);
  check("24-inch Full HD monitor: 100%", dprOf({ n: "24\" Full HD monitor", c: "monitor", d: 24, w: 1920, h: 1080 }) === 1);
  check("Surface Pro (13 in, 2880 × 1920): 200%, Microsoft's default", dprOf({ n: "Surface Pro 11", c: "tablet pc", d: 13, w: 2880, h: 1920 }) === 2);
  ({ v } = site(IPHONE, "portrait", "desktop"));
  check("forcing the desktop site on a phone lays out 980 px and shrinks it to fit (40%)", v.mode === "desktop" && v.lw === 980 && near(v.zoom, 393 / 980) && close(v.bodyPt, 16 * (393 / 980) * 3 / g.ppi * 72, 1e-12));
  ({ v } = site({ n: "My screen", c: "custom", d: 13, w: 16, h: 10, aspectOnly: true }));
  check("a screen without a pixel count gets no website estimate (instead of a wrong one)", v === null);
  ({ v } = site(TRI, "landscape"));
  check("an unknown custom screen gets a sensible default scaling (≥ 1×)", v.dpr >= 1 && Number.isFinite(v.vw) && v.vw > 0);
  const csv = app.parseCsv(fs.readFileSync(path.join(ROOT, "devices.csv"), "utf8")); csv.shift();
  const bad = [], phones = [];
  for (const r of csv.filter(r => r[1] !== "paper")) {
    const dev = { n: r[0], c: app.catKey(r[1]), d: +r[2], w: Math.max(+r[3], +r[4]), h: Math.min(+r[3], +r[4]) };
    const P = site(dev, "portrait").v, L = site(dev, "landscape").v;
    if (!(P.dpr >= 1 && Number.isFinite(P.dpr) && P.vw > 0 && P.vh > 0 && P.vw === L.vh && P.vh === L.vw && P.dpr === L.dpr)) bad.push(dev.n);
    if (dev.c === "phone" && !/^iPhone/.test(dev.n) && dev.d >= 3 && dev.w / dev.h > 1.6 && !(P.vw >= 340 && P.vw <= 480)) phones.push(`${dev.n} ${P.vw}`);
  }
  check("every built-in screen: scaling ≥ 1×, and rotating swaps the browser width and height", bad.length === 0, bad.slice(0, 3).join(", "));
  check("Android phones (not tiny cover screens) come out 340–480 CSS px wide, like real ones", phones.length === 0, phones.slice(0, 4).join(", "));
}

// ---------------------------------------------------------------------------------------------------------
async function deviceList() {
  section("Device list (devices.csv)");
  const text = fs.readFileSync(path.join(ROOT, "devices.csv"), "utf8");
  const rows = app.parseCsv(text), head = rows.shift();
  check("header is name,type,diagonal,width,height", head.join(",") === "name,type,diagonal,width,height", head.join(","));
  const TYPES = ["phone", "tablet", "ereader", "tablet pc", "laptop", "monitor", "paper"];
  const num = s => /^\d+(\.\d+)?$/.test(s);
  const badType = rows.filter(r => !TYPES.includes(r[1])), badCells = rows.filter(r => r.length !== 5 || !r[0]);
  check("every line has 5 cells and a known type", badType.length === 0 && badCells.length === 0, badType.concat(badCells).slice(0, 3).map(r => r.join(",")).join(" | "));
  const screens = rows.filter(r => r[1] !== "paper"), paper = rows.filter(r => r[1] === "paper");
  const badScreen = screens.filter(r => !num(r[2]) || !/^\d+$/.test(r[3]) || !/^\d+$/.test(r[4]) || !(+r[2] > 0) || !(+r[3] > 0) || !(+r[4] > 0));
  check("screens have a positive diagonal and whole-number pixel counts", badScreen.length === 0, badScreen.slice(0, 3).map(r => r[0]).join(", "));
  const badPaper = paper.filter(r => r[2] !== "" || !num(r[3]) || !num(r[4]) || !(+r[3] > 0) || !(+r[4] > 0));
  check("paper sizes leave the diagonal empty and give inches", badPaper.length === 0, badPaper.map(r => r[0]).join(", "));
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const m = /Search (\d+) built-in screens plus (\d+) paper/.exec(readme);
  check("README device count matches the CSV", m && +m[1] === screens.length && +m[2] === paper.length, m ? `README ${m[1]} + ${m[2]}, CSV ${screens.length} + ${paper.length}` : "count not found in README");
  // IDs: the app finds devices by an ID made from the name, so two names must never make the same ID
  const ids = rows.map(r => app.slug(r[0]));
  const dupIds = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))].map(id => rows.filter(r => app.slug(r[0]) === id).map(r => r[0]).join(" = "));
  check("every device has its own ID (no two names collide)", dupIds.length === 0, dupIds.slice(0, 4).join("; "));
  const names = rows.map(r => r[0].toLowerCase());
  check("no device is listed twice", names.length === new Set(names).size);
  // Pixel density sanity ranges per type. Anything outside is probably a typo in the diagonal or pixels.
  const RANGE = { phone: [200, 600], tablet: [120, 400], ereader: [150, 350], "tablet pc": [100, 450], laptop: [90, 350], monitor: [50, 250] };
  const odd = screens.map(r => ({ n: r[0], t: r[1], ppi: Math.hypot(+r[3], +r[4]) / +r[2], ar: Math.max(+r[3], +r[4]) / Math.min(+r[3], +r[4]) }))
    .filter(o => o.ppi < RANGE[o.t][0] || o.ppi > RANGE[o.t][1] || o.ar < 1 || o.ar > 4);
  check("pixel density and shape are plausible for each type (flags likely typos)", odd.length === 0, odd.slice(0, 4).map(o => `${o.n}: ${Math.round(o.ppi)} ppi, ${o.ar.toFixed(2)}:1`).join("; "));
  // Old IDs kept working after renames must point at devices that exist, and must not shadow a current device
  const renamed = JSON.parse(/const RENAMED = (\{.*?\});/.exec(html)[1]);
  const idSet = new Set(ids);
  const badRen = Object.entries(renamed).filter(([o, n]) => !idSet.has(n) || idSet.has(o));
  check("renamed devices point to current IDs", badRen.length === 0, badRen.map(e => e.join(" → ")).join(", "));
  const oldPaper = load(["OLD_PAPER_IDS"]).OLD_PAPER_IDS;
  const badOld = Object.entries(oldPaper).filter(([, n]) => !idSet.has(n));
  check("old page-size names point to current paper sizes", badOld.length === 0, badOld.map(e => e.join(" → ")).join(", "));
  const def = load(["defaults"]).defaults();
  check("the first-visit screens and page size exist", def.sel.every(s => idSet.has(s.id)) && idSet.has(def.paper));

  // loadDevices: the app's own loader, given made-up files through a pretend fetch()
  const loader = csv => { const L = load(["loadDevices", "parseCsv", "BUILTIN", "CATS", "catKey", "slug"], { fetch: async () => ({ ok: true, text: async () => csv }) }, "function builtin() { return BUILTIN; }"); return L.loadDevices().then(() => L.builtin()); };
  const [a, b, c] = await Promise.all([
    loader("# comment\r\nname,type,diagonal,width,height\r\nTest Phone,phone,6.1,1170,2532\r\n\r\nA4 paper,paper,,8.268,11.693\r\n"),
    loader("type,name,height,width,diagonal,source,ppi\nphone,Reordered,2532,1170,6.1,https://example.com,460\nlaptop,\"Laptop, 14\"\"\",1200,1920,14,,\n"),
    loader("name,type,diagonal,width,height\nNo size,phone,,1170,2532\nBad,phone,abc,1,1\nZero,tablet,0,100,100\nNegative,laptop,-13,1920,1080\nWatch,watch,1.5,400,400\nGood,tablet,11,2420,1668\n"),
  ]);
  {
    check("CSV: comments, blank lines and Windows line endings are fine; pixels are stored landscape", a.length === 2 && a[0].w === 2532 && a[0].h === 1170 && a[0].d === 6.1);
    check("CSV: paper uses inches and gets a diagonal worked out", a[1].sheet && near(a[1].d, Math.hypot(8.268, 11.693), 0.005) && a[1].aspectOnly);
    check("CSV: columns can be in any order, and extra columns (like a source link) are ignored", b.length === 2 && b[0].n === "Reordered" && b[0].d === 6.1 && b[0].w === 2532);
    check("CSV: quoted names with commas and quotes work", b[1] && b[1].n === "Laptop, 14\"" && b[1].w === 1920);
    check("CSV: lines with a missing, zero, negative or non-numeric size, or an unknown type, are skipped", c.length === 1 && c[0].n === "Good", c.map(d => d.n).join(", "));
  }
}

// ---------------------------------------------------------------------------------------------------------
// The service worker (sw.js), run against a pretend browser cache so the update rules can be checked exactly
async function serviceWorker() {
  section("Offline saving (sw.js)");
  const src = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const SCOPE = "https://example.test/screen-compare/";
  const env = () => {
    const store = new Map(), listeners = {}, fetched = [];
    const key = r => typeof r === "string" ? new URL(r, SCOPE).href : r.url;
    const caches = {
      keys: async () => [...store.keys()],
      delete: async n => store.delete(n),
      open: async n => {
        if (!store.has(n)) store.set(n, new Map());
        const m = store.get(n);
        return { match: async r => m.get(key(r)), put: async (r, res) => { m.set(key(r), res); }, keys: async () => [...m.keys()].map(url => ({ url })), addAll: async reqs => { for (const r of reqs) m.set(key(r), { ok: true }); } };
      },
    };
    class Request { constructor(u) { this.url = new URL(u, SCOPE).href; } }
    const ctx = vm.createContext({
      URL, Request, Response: class {}, caches, setTimeout, Promise, console,
      fetch: async u => { fetched.push(key(u)); return { ok: true, clone() { return this; }, redirected: false }; },
      location: { origin: "https://example.test" },
      self: { registration: { scope: SCOPE }, addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    });
    vm.runInContext(src, ctx, { filename: "sw.js" });
    const fire = async (type, extra = {}) => { let p = null; const e = { waitUntil(x) { p = x; }, respondWith(x) { e.responded = true; p = x; }, ...extra }; listeners[type](e); if (p) await p; return e; };
    return { store, fire, fetched, version: vm.runInContext("[CORE_CACHE, PDF_CACHE, CORE, PDF_FILES, PDFJS_VERSION]", ctx) };
  };
  const pdfjsVersion = /pdfjs\/([\d.]+)\//.exec(html)[1];
  let w = env();
  const [CORE_CACHE, PDF_CACHE, CORE, PDF_FILES, PV] = w.version;
  check("sw.js names the same pdf.js version as index.html", PV === pdfjsVersion, `${PV} vs ${pdfjsVersion}`);
  check("every file the worker saves exists in the repo", CORE.every(f => f === "./" || fs.existsSync(path.join(ROOT, f))) && PDF_FILES.every(f => fs.existsSync(path.join(ROOT, "pdfjs", PV, f))));
  // An older version's caches, the current ones, and another site's cache on the same domain
  const seed = (s, n, urls = []) => s.set(n, new Map(urls.map(u => [u, { ok: true }])));
  seed(w.store, "tss-core-v1", [SCOPE, SCOPE + "pdfjs/3.11.174/pdf.min.mjs"]);
  seed(w.store, "tss-pdfjs-3.11.174"); seed(w.store, "someone-elses-cache");
  await w.fire("install");
  check("installing saves the page, device list, icons and manifest", CORE.every(f => w.store.get(CORE_CACHE).has(new URL(f, SCOPE).href)));
  check("a visitor who used PDFs before gets the new PDF reader saved during the update", PDF_FILES.every(f => w.store.get(PDF_CACHE) && w.store.get(PDF_CACHE).has(SCOPE + "pdfjs/" + PV + "/" + f)));
  await w.fire("activate");
  check("activating deletes the old version's caches and keeps the current ones", [...w.store.keys()].sort().join(",") === [CORE_CACHE, PDF_CACHE, "someone-elses-cache"].sort().join(","), [...w.store.keys()].join(","));
  w = env();
  await w.fire("install");
  check("a visitor who never opened a PDF doesn't download the PDF reader", !w.store.has(PDF_CACHE) && !w.fetched.some(u => u.includes("/pdfjs/")));
  const req = (u, mode = "no-cors", method = "GET") => ({ request: { url: new URL(u, SCOPE).href, mode, method } });
  const handled = async (u, mode, method) => !!(await w.fire("fetch", req(u, mode, method))).responded;
  check("the app page and device list are handled offline", await handled(SCOPE, "navigate") && await handled(SCOPE + "index.html", "navigate") && await handled(SCOPE + "devices.csv"));
  check("the current pdf.js files are handled; another version's files never are", await handled(SCOPE + `pdfjs/${PV}/pdf.min.mjs`) && !(await handled(SCOPE + "pdfjs/3.11.174/pdf.min.mjs")));
  check("other pages, other sites (analytics) and form posts are left alone", !(await handled(SCOPE + "LICENSE", "navigate")) && !(await handled("https://gc.zgo.at/count.js")) && !(await handled(SCOPE, "navigate", "POST")));
}

(async () => {
  try { await deviceList(); await serviceWorker(); }
  catch (e) { check("test crashed: " + e.message, false, e.stack.split("\n")[1]); }
  finish();
})();
