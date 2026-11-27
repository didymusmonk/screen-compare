// Browser integration tests for True Size Screens: what a visitor actually sees on the cards and in the drawing.
// smoke.js checks that every feature works at all; this file checks that the numbers are right and stay right.
//
//   node tests/browser.js
//
// Most checks use made-up screens with easy numbers, saved into the browser before the page loads:
// "Test 13" is 13 inches with 1200 × 500 pixels, which is exactly 12 × 5 inches at 100 pixels per inch
// (the 5-12-13 triangle), so the expected values below can be checked by hand.

const path = require("path");
const { chromium, devices } = require("playwright");
const { serve, makePdf } = require("./lib/web");
const { check, section, near, finish } = require("./lib/check");

const ROOT = path.join(__dirname, "..");
const TEST13 = { id: "c-tri", n: "Test 13", c: "custom", d: 13, w: 1200, h: 500 };
const TWIN13 = { id: "c-twin", n: "Twin 13", c: "custom", d: 13, w: 1200, h: 500 };
const LOW13 = { id: "c-low", n: "Low 13", c: "custom", d: 13, w: 600, h: 250 };   // same size, 50 ppi
const SHAPE = { id: "c-shape", n: "Shape only", c: "custom", d: 13, w: 12, h: 5, aspectOnly: true };
const CUSTOM = [TEST13, TWIN13, LOW13, SHAPE];
const sel = (...ids) => ids.map((id, k) => ({ id, uid: "t" + k }));

// What the server sends; tests can swap a file for one run
let override = () => null;
let browser, base;

// Opens the app in a fresh browser profile with the given saved state (what localStorage holds before the visit)
async function open({ state, custom = CUSTOM, ppiCal, hash = "", raw = {}, ctxOptions = { viewport: { width: 1280, height: 800 } }, wait = "#cards .card" } = {}) {
  const ctx = await browser.newContext(ctxOptions);
  await ctx.route(url => !url.href.startsWith(base), r => r.abort()); // no analytics during tests
  const store = { ...(state && { "tss:state": JSON.stringify(state) }), ...(custom && { "tss:custom": JSON.stringify(custom) }), ...(ppiCal != null && { "tss:ppiCal": JSON.stringify(ppiCal) }), ...raw };
  await ctx.addInitScript(s => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, store);
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", e => p.errors.push(e.message));
  p.on("console", m => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) p.errors.push(m.text()); });
  await p.goto(base + hash);
  if (wait) await p.waitForSelector(wait, { timeout: 8000 });
  return { ctx, p };
}
// Every card's numbers, as shown: { name, ppi, orient, "Diagonal": "13″", ... }
const cards = p => p.$$eval("#cards .card", cs => cs.map(c => {
  const o = { name: c.querySelector("h3").firstChild.textContent, ppi: c.querySelector(".ppi-big b").textContent };
  const on = c.querySelector('[data-act="orient"][aria-pressed="true"]'); o.orient = on && on.dataset.v;
  c.querySelectorAll("dt").forEach(d => { o[d.textContent] = d.nextElementSibling.textContent; });
  return o;
}));
// Each screen's outline in the drawing, in screen pixels
const outlines = p => p.$$eval("#stage .scr", gs => gs.map(g => { const r = g.querySelector("rect"); return { i: +g.dataset.i, x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width"), h: +r.getAttribute("height") }; }).sort((a, b) => a.i - b.i));
const click = (p, s) => p.click(s);
const cardBtn = (p, i, act, v) => p.click(`#cards [data-act="${act}"][data-i="${i}"]${v ? `[data-v="${v}"]` : ""}`);
const setRange = (p, s, v) => p.$eval(s, (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
const statsOnly = cs => cs.map(c => { const o = { ...c }; return JSON.stringify(o); }).join("|");
const pdfStatus = p => p.textContent("#pdf-status");
// Waits until the PDF status has stopped changing (all pending page renders are done)
async function pdfSettled(p, ms = 900) {
  let last = null, since = Date.now();
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const t = await pdfStatus(p);
    if (t !== last) { last = t; since = Date.now(); }
    else if (Date.now() - since > ms && !/^Reading|Finding/.test(t)) return t;
    await p.waitForTimeout(100);
  }
  return last;
}
// Width ÷ height of the page images in the drawing (each page has its own size in the test PDFs)
const imageShapes = p => p.$$eval("#stage .scr image", async els => Promise.all(els.map(e => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth / i.naturalHeight); i.onerror = () => r(null); i.src = e.getAttribute("href"); }))));
// Same places in the drawing, give or take half a pixel (share links round positions to 0.01 in)
const sameSpots = (a, b) => a.length === b.length && a.every((o, k) => ["x", "y", "w", "h"].every(q => near(o[q], b[k][q], 0.5)));
// The first difference between two snapshots, for failure messages
const diff = (a, b, at = "") => { if (JSON.stringify(a) === JSON.stringify(b)) return ""; if (a && b && typeof a === "object" && typeof b === "object") { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = diff(a[k], b[k], at + "." + k); if (d) return d; } } return `${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`; };
const noErrors = (p, what) => check(`${what}: no JavaScript errors`, p.errors.length === 0, p.errors.slice(0, 2).join(" | "));

// ---------------------------------------------------------------------------------------------------------
async function myScreenMatching() {
  section("Compare with my screen");
  // Use the same resolution across categories to check filtering and exact-match order.
  const csv = [
    "name,type,diagonal,width,height",
    "Test phone,phone,6,1200,800",
    "Test tablet,tablet,10,1200,800",
    "Test tablet PC,tablet pc,12,1200,800",
    "Closer tablet PC,tablet pc,12,1440,960",
    "Test laptop,laptop,14,1200,800",
    "Test monitor,monitor,24,1200,800",
  ].join("\n");
  override = pth => pth.endsWith("/devices.csv") ? { body: csv } : null;
  try {
    for (const { label, hasTouch, screen, expected } of [
      { label: "touch exact match", hasTouch: true, screen: { width: 1200, height: 800 }, expected: ["test-phone", "test-tablet", "test-tablet-pc"] },
      { label: "touch shape match", hasTouch: true, screen: { width: 1500, height: 1000 }, expected: ["test-phone", "test-tablet", "closer-tablet-pc", "test-tablet-pc"] },
      { label: "desktop exact match", hasTouch: false, screen: { width: 1200, height: 800 }, expected: ["test-laptop", "test-monitor", "test-tablet-pc"] },
    ]) {
      const { ctx, p } = await open({
        state: { sel: sel("c-tri"), content: "none" },
        ctxOptions: { viewport: { width: 1000, height: 700 }, screen, hasTouch },
      });
      try {
        await p.getByRole("button", { name: "Compare with my screen", exact: true }).click();
        const choices = p.locator("#myphone-pick button[data-id]");
        const ids = await choices.evaluateAll(buttons => buttons.map(b => b.dataset.id));
        check(`${label}: suggests the expected models in order`, ids.join() === expected.join(), ids.join(", "));
        if (label === "touch exact match") {
          if (ids.includes("test-tablet-pc")) await choices.filter({ hasText: "Test tablet PC" }).click();
          check("choosing the suggested tablet PC adds it to the comparison", (await cards(p)).some(c => c.name === "Test tablet PC"));
        }
      } finally {
        await ctx.close();
      }
    }
  } finally {
    override = () => null;
  }
}

async function geometry() {
  section("Screens and their numbers");
  const { ctx, p } = await open({ state: { sel: sel("c-tri", "c-twin", "c-low") } });
  let c = await cards(p);
  check("Test 13 shows 100 PPI, 13″, 500 × 1200 upright, 5.00″ × 12.00″, 60 sq in", c[0].ppi === "100" && c[0]["Diagonal"] === "13″" && c[0]["Resolution"] === "500 × 1200"
    && c[0]["Screen size"] === "5.00″ × 12.00″" && c[0]["Area"] === "60.0 sq in", JSON.stringify(c[0]));
  check("an identical screen shows identical numbers", JSON.stringify({ ...c[0], name: "" }) === JSON.stringify({ ...c[1], name: "" }));
  check("same size with half the pixels: same size and area, 50 PPI", c[2].ppi === "50" && c[2]["Screen size"] === c[0]["Screen size"] && c[2]["Area"] === c[0]["Area"]);
  check("megapixels: 1200 × 500 is 0.60 MP, 600 × 250 is 0.15 MP", c[0]["Megapixels"] === "0.60 MP" && c[2]["Megapixels"] === "0.15 MP", JSON.stringify([c[0]["Megapixels"], c[2]["Megapixels"]]));
  let o = await outlines(p);
  check("the drawing makes identical screens identical in size", near(o[0].w, o[1].w, 0.01) && near(o[0].h, o[1].h, 0.01) && near(o[0].w, o[2].w, 0.01));
  check("the drawing keeps the 5 : 12 shape", near(o[0].h / o[0].w, 12 / 5, 0.01));
  await cardBtn(p, 0, "orient", "landscape");
  c = await cards(p); o = await outlines(p);
  check("rotating one screen swaps its size and pixels, keeps PPI, area, diagonal and megapixels", c[0].orient === "landscape" && c[0]["Screen size"] === "12.00″ × 5.00″" && c[0]["Resolution"] === "1200 × 500"
    && c[0].ppi === "100" && c[0]["Area"] === "60.0 sq in" && c[0]["Diagonal"] === "13″" && c[0]["Megapixels"] === "0.60 MP" && c[1].orient === "portrait");
  check("and its outline turns sideways", near(o[0].w / o[0].h, 12 / 5, 0.01) && near(o[0].w, o[1].h, 0.01));
  await cardBtn(p, 0, "orient", "portrait");
  o = await outlines(p);
  await click(p, '#units button[data-v="cm"]');
  c = await cards(p);
  check("centimeters: 33.0 cm diagonal, 12.7 × 30.5 cm, 387 cm², PPI and megapixels unchanged", c[0]["Diagonal"] === "33.0 cm" && c[0]["Screen size"] === "12.7 cm × 30.5 cm" && c[0]["Area"] === "387 cm²" && c[0].ppi === "100" && c[0]["Megapixels"] === "0.60 MP", JSON.stringify(c[0]));
  const o2 = await outlines(p);
  check("changing units doesn't move or resize anything in the drawing", JSON.stringify(o2) === JSON.stringify(o));
  await click(p, '#units button[data-v="in"]');

  // Zoom, actual size and calibration change the drawing, never the numbers
  for (const content of ["page", "video", "ebook", "site", "none"]) {
    await click(p, `#content button[data-v="${content}"]`);
    const before = statsOnly(await cards(p));
    await setRange(p, "#zoom", 30); const a = await outlines(p);
    await setRange(p, "#zoom", 90); const b = await outlines(p);
    const after = statsOnly(await cards(p));
    check(`zooming changes the drawing but not the card numbers ("${content}" mode)`, before === after && near(b[0].w / a[0].w, 3, 0.02), `${a[0].w} → ${b[0].w}`);
  }
  await click(p, '#content button[data-v="page"]');
  await setRange(p, "#zoom", 40);
  o = await outlines(p);
  check("manual zoom 40 draws 40 px per inch (5 in wide → 200 px)", near(o[0].w, 200, 0.05) && near(o[0].h, 480, 0.05), `${o[0].w} × ${o[0].h}`);
  await click(p, '#scaleMode button[data-v="actual"]');
  o = await outlines(p);
  check("actual size uses 96 px per inch until calibrated (5 in → 480 px)", near(o[0].w, 480, 0.05));
  check("and says it isn't calibrated yet", /96 screen pixels per inch \(default, calibrate for accuracy\)/.test(await p.textContent("#scale-note")), await p.textContent("#scale-note"));
  const beforeCal = statsOnly(await cards(p));
  await click(p, "#cal-btn");
  await setRange(p, "#cal-range", 120);
  o = await outlines(p);
  check("calibrating to 120 px per inch redraws at that scale (5 in → 600 px)", near(o[0].w, 600, 0.05), o[0].w);
  const cc = await p.$eval("#cal-card", e => [parseFloat(e.style.width), parseFloat(e.style.height)]);
  check("the calibration card is 85.60 × 53.98 mm at that scale (404.41 × 255.02 px)", near(cc[0], 85.6 / 25.4 * 120, 0.002) && near(cc[1], 53.98 / 25.4 * 120, 0.002), cc.join(" × "));
  check("calibration doesn't change any card numbers", statsOnly(await cards(p)) === beforeCal);
  check("and the note says it's calibrated", /120 screen pixels per inch \(calibrated\)/.test(await p.textContent("#scale-note")));
  await p.reload(); await p.waitForSelector("#cards .card");
  o = await outlines(p);
  check("calibration is remembered after a reload", near(o[0].w, 600, 0.05), o[0].w);
  noErrors(p, "screens");
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function customForm() {
  section("Entering your own screen");
  const { ctx, p } = await open({ state: { sel: [] }, custom: [], wait: "#results .res" });
  const tryAdd = async (f) => {
    await p.evaluate(f => {
      for (const id of ["c-name", "c-diag", "c-w", "c-h", "c-aw", "c-ah"]) document.getElementById(id).value = "";
      document.getElementById("c-unit").value = f.unit || "in";
      for (const [k, v] of Object.entries(f)) if (k !== "unit") document.getElementById("c-" + k).value = v;
      document.getElementById("custom").requestSubmit();
    }, f);
    return { n: await p.locator("#cards .card").count(), err: (await p.isVisible("#c-err")) ? await p.textContent("#c-err") : "" };
  };
  const bad = [
    [{ diag: "" , w: 1200, h: 500 }, "no diagonal"], [{ diag: 0, w: 1200, h: 500 }, "zero diagonal"], [{ diag: -13, w: 1200, h: 500 }, "negative diagonal"],
    [{ diag: "1e400", w: 1200, h: 500 }, "infinite diagonal"], [{ diag: 500, w: 1200, h: 500 }, "500-inch diagonal"],
    [{ diag: 13 }, "no pixels or shape"], [{ diag: 13, w: -1200, h: 500 }, "negative pixels"], [{ diag: 13, w: 0, h: 0 }, "zero pixels"],
    [{ diag: 13, w: "1e400", h: 500 }, "infinite pixel width"], [{ diag: 13, aw: -16, ah: 9 }, "negative aspect ratio"], [{ diag: 13, aw: "1e400", ah: 9 }, "infinite aspect ratio"],
  ];
  for (const [f, what] of bad) {
    const r = await tryAdd(f);
    check(`rejects ${what}`, r.n === 0 && r.err.length > 0, `${r.n} screens added, message "${r.err}"`);
    if (r.n) await p.click('#cards [data-act="remove"]');
  }
  let r = await tryAdd({ name: "Form 13", diag: 13, w: 1200, h: 500 });
  let c = await cards(p);
  check("accepts 13 in, 1200 × 500 and shows 100 PPI, 5.00″ × 12.00″", r.n === 1 && c[0].name === "Form 13" && c[0].ppi === "100" && c[0]["Screen size"] === "5.00″ × 12.00″" && !(await p.isVisible("#c-err")));
  r = await tryAdd({ name: "Form cm", diag: 33.02, unit: "cm", w: 500, h: 1200 });
  c = await cards(p);
  check("33.02 cm is stored as 13 in; pixels in either order", r.n === 2 && c[1]["Diagonal"] === "13″" && c[1]["Screen size"] === c[0]["Screen size"] && c[1].ppi === "100");
  r = await tryAdd({ name: "Form shape", diag: 13, aw: 12, ah: 5 });
  c = await cards(p);
  check("a shape without pixels gives a size and says PPI is unknown", r.n === 3 && c[2]["Screen size"] === "5.00″ × 12.00″" && /PPI unknown/.test(await p.textContent("#cards .card:nth-child(3) .ppi-big")));
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem("tss:custom")));
  check("your screens are saved in this browser", stored.length === 3 && stored.every(d => d.c === "custom" && d.d === 13));
  noErrors(p, "custom screen form");
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function pages() {
  section("Page and PDF fit");
  const { ctx, p } = await open({ state: { sel: sel("c-tri", "c-tri"), paper: "us-letter-paper", content: "page", fit: "page" } });
  await cardBtn(p, 1, "orient", "landscape");
  const pdfBox = c => [c["Size vs. printed page"], c["12 pt text looks like"], c["Pixels per page inch"], c["Page visible at once"] || c["Spread visible at once"]].join(" / ");
  let c = await cards(p);
  check("Fit page, Letter, upright 5 × 12 in: 59%, 7.1 pt, 59 px per page inch, whole page", pdfBox(c[0]) === "59% / 7.1 pt / 59 / 100%", pdfBox(c[0]));
  check("Fit page, sideways 12 × 5 in: 45%, 5.5 pt, whole page", pdfBox(c[1]) === "45% / 5.5 pt / 45 / 100%", pdfBox(c[1]));
  // the page in the drawing: its paper rectangle sits inside the screen and touches two edges
  const paperRects = () => p.$$eval("#stage .scr", gs => gs.map(g => { const rs = [...g.querySelectorAll("rect")]; const s = rs[0], pg = rs.find(r => r.getAttribute("fill") === "var(--paper)"); const v = r => ["x", "y", "width", "height"].map(a => +r.getAttribute(a)); return { s: v(s), p: v(pg) }; }));
  let pr = await paperRects();
  check("Fit page draws the whole page inside the screen, touching two edges", pr.every(({ s, p: q }) => q[2] <= s[2] + 0.5 && q[3] <= s[3] + 0.5 && (near(q[2], s[2], 0.5) || near(q[3], s[3], 0.5))));
  check("and at Letter's shape", pr.every(({ p: q }) => near(q[3] / q[2], 11 / 8.5, 0.01)));
  await click(p, '#fit button[data-v="width"]');
  c = await cards(p); pr = await paperRects();
  check("Fit width, sideways: 141%, 16.9 pt, 141 px per page inch, 32% of the page", pdfBox(c[1]) === "141% / 16.9 pt / 141 / 32%", pdfBox(c[1]));
  check("Fit width fills the screen's width exactly", pr.every(({ s, p: q }) => near(q[2], s[2], 0.5)), JSON.stringify(pr));
  await click(p, '#fit button[data-v="actual"]');
  c = await cards(p); pr = await paperRects();
  check("100%: printed size, 12.0 pt, 100 px per page inch; 59% and 45% of the page visible", pdfBox(c[0]) === "100% / 12.0 pt / 100 / 59%" && pdfBox(c[1]) === "100% / 12.0 pt / 100 / 45%", pdfBox(c[0]) + " | " + pdfBox(c[1]));
  const s = (await outlines(p))[0].w / 5; // drawing pixels per inch
  check("100% draws the page 8.5 in wide at the drawing's scale", pr.every(({ p: q }) => near(q[2], 8.5 * s, 0.5)));
  await cardBtn(p, 1, "fit", "page");
  await cardBtn(p, 1, "spread");
  c = await cards(p);
  check("one card can use its own fit and two pages: two Letter pages on 12 × 5 in fit at 45%", c[0]["Size vs. printed page"] === "100%" && pdfBox(c[1]) === "45% / 5.5 pt / 45 / 100%" && "Spread visible at once" in c[1], pdfBox(c[1]));
  await cardBtn(p, 1, "orient", "portrait");
  c = await cards(p);
  check("two pages on an upright 5 × 12 in screen: 29%", c[1]["Size vs. printed page"] === "29%");
  check("the two-page view draws two pages side by side", (await p.$$eval('#stage .scr[data-i="1"] rect[fill="var(--paper)"]', r => r.length)) === 2);
  noErrors(p, "page fit");
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
// Each test page has its own size, so the size shown proves which page was drawn
const PAGE_SIZES = [[360, 504], [504, 360], [612, 792], [420, 595], [288, 432], [432, 288]]; // 5×7, 7×5, Letter, A5, 4×6, 6×4 in
// Page 3 is slow to draw, so a quick page turn past it would show it late if old renders weren't thrown away
const heavy = (w, h) => { let d = "0 0 0 rg "; for (let i = 0; i < 60000; i++) d += `${(i * 7) % (w - 20) + 10} ${(i * 13) % (h - 20) + 10} 1 1 re `; return d + "f"; };
const sizesPdf = () => makePdf(PAGE_SIZES.map(([w, h], k) => ({ w, h, draw: k === 2 ? heavy(w, h) : `0 0 0 rg 36 36 ${w - 72} ${h - 72} re f` })));
// A heavy PDF that takes noticeably longer to read and draw than a tiny one
const slowPdf = () => { let d = "0 0 0 rg "; for (let i = 0; i < 40000; i++) d += `${(i * 7) % 340 + 10} ${(i * 13) % 480 + 10} 1 1 re `; d += "f"; return makePdf([{ w: 360, h: 504, draw: d }, { w: 360, h: 504, draw: d }]); };
async function pdfs() {
  section("Your own PDF");
  const { ctx, p } = await open({ state: { sel: sel("c-tri"), paper: "us-letter-paper", content: "page", fit: "page" } });
  await p.setInputFiles("#pdf-file", { name: "sizes.pdf", mimeType: "application/pdf", buffer: sizesPdf() });
  await p.waitForFunction(() => /^sizes: page 1 is 5\.00 × 7\.00 in/.test(document.querySelector("#pdf-status").textContent), null, { timeout: 15000 });
  let c = await cards(p);
  check("a 5 × 7 in page on an upright 5 × 12 in screen fits at 100%", c[0]["Size vs. printed page"] === "100%" && c[0]["Page visible at once"] === "100%");
  await click(p, "#pg-next"); await pdfSettled(p);
  c = await cards(p);
  check("page 2 is landscape 7 × 5 in and fits at 71%", /page 2 is 7\.00 × 5\.00 in/.test(await pdfStatus(p)) && c[0]["Size vs. printed page"] === "71%", (await pdfStatus(p)) + " " + c[0]["Size vs. printed page"]);
  let shapes = await imageShapes(p);
  check("the drawing shows page 2's landscape image", shapes.length === 1 && near(shapes[0], 7 / 5, 0.02), JSON.stringify(shapes));
  // Rapid page turns: the last page asked for must be the one shown, with its own size and image
  await p.evaluate(() => { for (let k = 0; k < 3; k++) document.getElementById("pg-next").click(); });
  let st = await pdfSettled(p);
  c = await cards(p); shapes = await imageShapes(p);
  check("after three quick page turns, page 5 (4 × 6 in) is shown", /page 5 is 4\.00 × 6\.00 in/.test(st) && await p.inputValue("#pg-number") === "5" && await p.textContent("#pg-total") === "of 6", st);
  check("…with page 5's own image and fit, 125% (no leftover from the slow page 3)", shapes.length === 1 && near(shapes[0], 4 / 6, 0.02) && c[0]["Size vs. printed page"] === "125%", JSON.stringify(shapes) + " " + c[0]["Size vs. printed page"]);
  await click(p, '#spreadAll button[data-v="spread"]');
  await p.evaluate(() => { for (let k = 0; k < 4; k++) document.getElementById("pg-prev").click(); });
  st = await pdfSettled(p); shapes = await imageShapes(p);
  check("quick turns back to page 1 in two-page view show pages 1 and 2 (portrait, then landscape)", /page 1 is 5\.00 × 7\.00 in/.test(st) && shapes.length === 2 && near(shapes[0], 5 / 7, 0.02) && near(shapes[1], 7 / 5, 0.02), st + " " + JSON.stringify(shapes));
  await click(p, '#spreadAll button[data-v="single"]');
  const pageNumber = p.locator("#pg-number");
  await pageNumber.fill("5");
  await pageNumber.press("Enter");
  await p.waitForFunction(() => /page 5 is/.test(document.querySelector("#pdf-status").textContent));
  shapes = await imageShapes(p);
  check("Enter jumps directly to the typed page in single-page view", shapes.length === 1 && near(shapes[0], 4 / 6, 0.02), JSON.stringify(shapes));
  await click(p, '#spreadAll button[data-v="spread"]');
  await pageNumber.fill("7");
  await p.locator("#pdf-pager").getByRole("button", { name: "Go" }).click();
  check("the page field rejects numbers beyond the end", await pageNumber.evaluate(el => el.validity.rangeOverflow) && /page 5 is/.test(await pdfStatus(p)));
  await pageNumber.fill("1");
  await p.locator("#pdf-pager").getByRole("button", { name: "Go" }).click();
  await p.waitForFunction(() => /page 1 is/.test(document.querySelector("#pdf-status").textContent));
  shapes = await imageShapes(p);
  check("Go jumps to the first page of a spread", shapes.length === 2 && near(shapes[0], 5 / 7, 0.02) && near(shapes[1], 7 / 5, 0.02), JSON.stringify(shapes));
  await click(p, '#spreadAll button[data-v="single"]');
  // Replacing the PDF while the previous one is still loading: the newest file wins
  await p.setInputFiles("#pdf-file", { name: "slow.pdf", mimeType: "application/pdf", buffer: slowPdf() });
  await p.setInputFiles("#pdf-file", { name: "quick.pdf", mimeType: "application/pdf", buffer: makePdf([{ w: 288, h: 432 }]) });
  st = await pdfSettled(p, 2500);
  shapes = await imageShapes(p);
  check("choosing a second PDF before the first finished loading shows the second one", /^quick: page 1 is 4\.00 × 6\.00 in/.test(st) && shapes.length === 1 && near(shapes[0], 4 / 6, 0.02), st);
  await p.setInputFiles("#pdf-file", { name: "quick2.pdf", mimeType: "application/pdf", buffer: makePdf([{ w: 612, h: 792 }, { w: 792, h: 612 }]) });
  await p.evaluate(() => document.getElementById("pg-next").click());
  await p.setInputFiles("#pdf-file", { name: "last.pdf", mimeType: "application/pdf", buffer: makePdf([{ w: 432, h: 288 }]) });
  st = await pdfSettled(p, 2000);
  check("turning a page while a new PDF opens still ends on the new PDF's first page", /^last: page 1 is 6\.00 × 4\.00 in/.test(st) && (await p.isHidden("#pdf-pager")), st);
  // Not a PDF
  await p.setInputFiles("#pdf-file", { name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is not a PDF") });
  st = await pdfSettled(p);
  check("a file that isn't a PDF gets a plain message", /Couldn't open that file/.test(st), st);
  p.errors = p.errors.filter(e => !/Invalid PDF|InvalidPDFException/.test(e)); // logged on purpose for the bad file
  noErrors(p, "PDF");
  await ctx.close();

  for (const [width, height] of [[320, 568], [768, 1024], [1024, 768]]) {
    const { ctx: mobile, p: tablet } = await open({
      state: { sel: sel("c-tri"), content: "page" },
      ctxOptions: { viewport: { width, height }, screen: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    });
    await tablet.setInputFiles("#pdf-file", { name: "sizes.pdf", mimeType: "application/pdf", buffer: sizesPdf() });
    await tablet.waitForSelector("#pg-number");
    check(`${width} × ${height}: PDF controls fit above the drawing`, await tablet.locator("#pdf-toolbar").evaluate(toolbar => {
      const drawing = document.querySelector("#stage").getBoundingClientRect();
      const controls = [...toolbar.querySelectorAll("button, input")].filter(el => el.getClientRects().length);
      return toolbar.getBoundingClientRect().bottom <= drawing.top && controls.every(el => el.getBoundingClientRect().right <= innerWidth) && document.documentElement.scrollWidth <= innerWidth;
    }));
    const switcher = tablet.locator("#content");
    const modeNames = ["Video", "E-book", "Web", "None", "Pages"];
    const options = ["#video-ctrls", "#ebook-ctrls", "#site-ctrls", null, "#pdf-toolbar"];
    for (const [i, mode] of modeNames.entries()) {
      const button = switcher.getByRole("button", { name: mode, exact: true });
      await button.click();
      const layout = await tablet.locator("#content-options").evaluate(panel => {
        const bar = document.querySelector("#quickbar");
        const stage = document.querySelector("#stage");
        const visible = [...panel.children].filter(el => el.getClientRects().length);
        return {
          visible: visible.map(el => "#" + el.id),
          directlyBelow: bar.nextElementSibling === panel && panel.getBoundingClientRect().top >= bar.getBoundingClientRect().bottom && panel.getBoundingClientRect().bottom <= stage.getBoundingClientRect().top,
          pickerCount: document.querySelectorAll('#content, #content2').length,
          openPdfCount: document.querySelectorAll('#open-pdf').length,
        };
      });
      check(`${width} × ${height}: ${mode} shows one set of options below the mode picker`, await button.getAttribute("aria-pressed") === "true" && layout.pickerCount === 1 && layout.openPdfCount === 1 &&
        (options[i] ? layout.visible.join() === options[i] && layout.directlyBelow : layout.visible.length === 0), JSON.stringify(layout));
    }
    check(`${width} × ${height}: returning to Pages keeps the PDF and one visible Share control`, await tablet.locator("#pg-number").isVisible() && await tablet.locator("[data-share]:visible").count() === 1);
    if (width <= 768) {
      await tablet.locator("#cards").scrollIntoViewIfNeeded();
      await switcher.getByRole("button", { name: "Video", exact: true }).click();
      check(`${width} px: switching modes from the cards reveals the options below the sticky bar`, await tablet.locator("#content-options").evaluate(panel => {
        const bounds = panel.getBoundingClientRect(), bar = document.querySelector("#quickbar").getBoundingClientRect();
        return bounds.top >= bar.bottom && bounds.top < innerHeight;
      }));
    }
    noErrors(tablet, `PDF at ${width} × ${height}`);
    await mobile.close();
  }

  // The PDF reader can't be downloaded (flaky connection): a clear message, and it works once it can load
  let block = true;
  const b = await open({ state: { sel: sel("c-tri"), paper: "us-letter-paper", content: "page" } });
  await b.ctx.route(/pdfjs\//, r => block ? r.abort() : r.continue());
  await b.p.setInputFiles("#pdf-file", { name: "t.pdf", mimeType: "application/pdf", buffer: sizesPdf() });
  st = await pdfSettled(b.p);
  check("if the PDF reader can't load, the message says so", /The PDF reader didn't load/.test(st), st);
  block = false;
  await b.p.setInputFiles("#pdf-file", { name: "t.pdf", mimeType: "application/pdf", buffer: sizesPdf() });
  st = await pdfSettled(b.p);
  check("and trying again once it can load works", /^t: page 1 is 5\.00 × 7\.00 in/.test(st), st);
  await b.ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function video() {
  section("Video");
  const { ctx, p } = await open({ state: { sel: sel("c-tri", "c-tri"), content: "video", video: "16:9" } });
  await cardBtn(p, 1, "orient", "landscape");
  let c = await cards(p);
  const c169 = c[0];
  check("16:9 on an upright 5 × 12 in screen: 5.00 × 2.81 in picture, 4.59 in bars top and bottom, 23%", c[0]["Picture size"] === "5.00″ × 2.81″" && c[0]["Black bars"] === "top and bottom, 4.59″ each" && c[0]["Picture uses"] === "23% of screen" && c[0]["Picture pixels"] === "500 × 281", JSON.stringify(c[0]));
  check("turned sideways (12 × 5 in): 8.89 × 5.00 in, 1.56 in bars left and right, 74%", c[1]["Picture size"] === "8.89″ × 5.00″" && c[1]["Black bars"] === "left and right, 1.56″ each" && c[1]["Picture uses"] === "74% of screen" && c[1]["Picture pixels"] === "889 × 500", JSON.stringify(c[1]));
  // upright: 5 × 45/16 in, diagonal 5 × √(1 + 81/256) = 5.737 in, area 14.0625 sq in; sideways: 80/9 × 5 in, diagonal 5 × √(256/81 + 1) = 10.199 in, area 44.44 sq in
  check("picture diagonal and area leave out the bars: upright 5.74″ and 14.1 sq in, sideways 10.20″ and 44.4 sq in", c[0]["Picture diagonal"] === "5.74″" && c[0]["Picture area"] === "14.1 sq in" && c[1]["Picture diagonal"] === "10.20″" && c[1]["Picture area"] === "44.4 sq in", JSON.stringify([c[0]["Picture diagonal"], c[0]["Picture area"], c[1]["Picture diagonal"], c[1]["Picture area"]]));
  await click(p, '#units button[data-v="cm"]');
  const ccm = await cards(p);
  check("in centimeters: 14.6 cm and 91 cm² upright, 25.9 cm and 287 cm² sideways", ccm[0]["Picture diagonal"] === "14.6 cm" && ccm[0]["Picture area"] === "91 cm²" && ccm[1]["Picture diagonal"] === "25.9 cm" && ccm[1]["Picture area"] === "287 cm²", JSON.stringify([ccm[0]["Picture diagonal"], ccm[0]["Picture area"], ccm[1]["Picture diagonal"], ccm[1]["Picture area"]]));
  await click(p, '#units button[data-v="in"]');
  const pics = await p.$$eval("#stage .scr", gs => gs.map(g => { const s = g.querySelector("rect"), v = g.querySelector('rect[fill="url(#vidsky)"]'); const n = (r, a) => +r.getAttribute(a); return { sx: n(s, "x"), sy: n(s, "y"), sw: n(s, "width"), sh: n(s, "height"), vx: n(v, "x"), vy: n(v, "y"), vw: n(v, "width"), vh: n(v, "height") }; }));
  check("the drawn picture is 16:9 and centered, with equal bars", pics.every(q => near(q.vw / q.vh, 16 / 9, 0.01) && near(q.vx - q.sx, q.sx + q.sw - q.vx - q.vw, 0.5) && near(q.vy - q.sy, q.sy + q.sh - q.vy - q.vh, 0.5)));
  const beforeCal = statsOnly(await cards(p));
  await setRange(p, "#zoom", 25);
  await click(p, '#scaleMode button[data-v="actual"]');
  await click(p, "#cal-btn"); await setRange(p, "#cal-range", 150); await click(p, "#cal-done");
  check("zoom, actual size and calibration don't change the picture diagonal, area or any other video number", statsOnly(await cards(p)) === beforeCal);
  await p.selectOption("#video", "2.39:1");
  c = await cards(p);
  check("2.39:1 cinema upright: 5.00 × 2.09 in picture, 4.95 in bars", c[0]["Picture size"] === "5.00″ × 2.09″" && c[0]["Black bars"] === "top and bottom, 4.95″ each", JSON.stringify(c[0]));
  await p.selectOption("#video", "9:16");
  c = await cards(p);
  check("9:16 vertical video nearly fills the upright screen (5 × 8.89 in, bars top and bottom)", c[0]["Picture size"] === "5.00″ × 8.89″" && c[0]["Black bars"] === "top and bottom, 1.56″ each");
  check("…and the picture diagonal follows the shape: 10.20″ upright, 5.74″ sideways", c[0]["Picture diagonal"] === "10.20″" && c[1]["Picture diagonal"] === "5.74″", c[0]["Picture diagonal"] + " " + c[1]["Picture diagonal"]);
  await p.selectOption("#video", "16:9");
  const twin = await open({ state: { sel: sel("c-low"), content: "video", video: "16:9" } });
  const cl = await cards(twin.p);
  check("same size with fewer pixels: same picture size, diagonal and area, fewer picture pixels", cl[0]["Picture size"] === c169["Picture size"] && cl[0]["Picture diagonal"] === c169["Picture diagonal"] && cl[0]["Picture area"] === c169["Picture area"] && cl[0]["Picture pixels"] === "250 × 141");
  await twin.ctx.close();
  noErrors(p, "video");
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function ebook(ctxOptions, label) {
  section("E-book" + label);
  const phone = !!ctxOptions.isMobile;
  const { ctx, p } = await open({ ctxOptions, state: { sel: sel("c-tri", "c-low", "c-twin"), content: "ebook", ebookPt: 12, ebookCols: "1" } });
  const read = () => p.evaluate(() => [...document.querySelectorAll("#cards .card")].map((c, i) => {
    const dd = n => { const d = [...c.querySelectorAll("dt")].find(d => d.textContent.startsWith(n)); return d ? d.nextElementSibling.textContent : ""; };
    const g = document.querySelector(`#stage .scr[data-i="${i}"]`);
    const lines = [...g.querySelectorAll(".prose text")].map(t => t.textContent);
    return { words: +dd("Words per screen").replace(/\D/g, ""), lines: dd("Lines per"), cpl: dd("Characters per line"), cols: dd("Columns"), drawn: lines.join(" ").split(" ").filter(Boolean).length, first: lines[0] || "", bars: g.querySelectorAll("g > rect").length };
  }));
  if (phone) await setRange(p, "#zoom", 40); // big enough to draw letters instead of gray bars
  let e = await read();
  check("screens of the same size show the same words, lines and line length, whatever their PPI", e[0].words === e[1].words && e[0].lines === e[1].lines && e[0].cpl === e[1].cpl && e[0].words === e[2].words, JSON.stringify(e.map(x => x.words)));
  check("the word count matches the words drawn on each screen", e.every(x => x.words > 50 && x.words === x.drawn), JSON.stringify(e.map(x => [x.words, x.drawn])));
  check("every screen starts with the same opening words", e.every(x => x.first.startsWith("Had Elizabeth") && x.first === e[0].first), e.map(x => x.first.slice(0, 20)).join(" | "));
  check("an upright 5 × 12 in screen at 12 pt has 45 lines (11.4 in ÷ 0.25 in)", e[0].lines === "45", e[0].lines);
  // Larger type never fits more
  let prev = e.map(x => x.words), grew = [];
  for (const pt of ["14", "16", "18", "20", "24", "28"]) {
    await p.selectOption("#ebookPt", pt);
    const now = (await read()).map(x => x.words);
    if (now.some((w, k) => w > prev[k])) grew.push(`${pt} pt: ${prev} → ${now}`);
    prev = now;
  }
  check("bigger type never fits more words", grew.length === 0, grew.join("; "));
  await p.selectOption("#ebookPt", "12");
  if (!phone) {
    // Zoom and calibration don't change the counts
    const before = JSON.stringify(await read().then(r => r.map(({ words, lines, cpl }) => [words, lines, cpl])));
    await setRange(p, "#zoom", 25);
    await click(p, '#scaleMode button[data-v="actual"]'); await click(p, "#cal-btn"); await setRange(p, "#cal-range", 150);
    const after = JSON.stringify(await read().then(r => r.map(({ words, lines, cpl }) => [words, lines, cpl])));
    check("zoom, actual size and calibration don't change the counts", before === after, before + " vs " + after);
    await click(p, '#scaleMode button[data-v="fit"]');
  }
  // Columns: per card and for all
  await cardBtn(p, 0, "orient", "landscape");
  await cardBtn(p, 0, "cols", "2");
  e = await read();
  check("a card can switch to 2 columns on its own", e[0].cols === "2" && e[1].cols === "1" && e[0].words === e[0].drawn);
  await cardBtn(p, 0, "cols", "auto");
  e = await read();
  check("Auto on a sideways 12 × 5 in screen picks 2 columns and says so", e[0].cols === "2 (auto)", e[0].cols);
  await click(p, phone ? '#ebookCols button[data-v="1"]' : '#ebookCols button[data-v="1"]').catch(() => {});
  e = await read();
  if (!phone) check("the 1 column setting for all screens resets each card", e.every(x => x.cols === "1"));
  noErrors(p, "e-book" + label);
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function website() {
  section("Website");
  const { ctx, p } = await open({ state: { sel: [{ id: "iphone-17-pro", uid: "a" }, { id: "iphone-17-pro", uid: "b", flip: true }, { id: "c-shape", uid: "c" }], content: "site" } });
  const c = await cards(p);
  check("iPhone 17 Pro: 3× scaling, 402 × 874 CSS px (Apple's size)", c[0]["Display scaling"] === "3× (300%)" && c[0]["Browser width"] === "402 × 874 CSS px", JSON.stringify(c[0]));
  check("sideways: 874 × 402, same scaling, tablet layout", c[1]["Browser width"] === "874 × 402 CSS px" && c[1]["Display scaling"] === "3× (300%)" && c[1]["Layout"] === "Tablet");
  check("a screen without a pixel count asks for it instead of guessing", /Add the pixel count to preview websites/.test(await p.textContent("#cards .card:nth-child(3)")));
  await click(p, '#siteLayout button[data-v="desktop"]');
  const d = await cards(p);
  check("forcing the desktop site says it's shrunk to fit (402 / 980 = 41%)", /forced, would be mobile/.test(d[0]["Layout"]) && /shrinks it to 41%/.test(await p.textContent("#cards .card:nth-child(1)")));
  noErrors(p, "website");
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function persistence() {
  section("Saving and sharing");
  // Build a comparison with something non-default everywhere
  const { ctx, p } = await open({ state: { sel: [] }, wait: "#results .res" });
  for (const q of ["A20 Pro", "Galaxy S25 Ultra", "Test 13"]) { await p.fill("#q", q); await p.locator("#results .res").first().click(); }
  await p.fill("#q", "");
  await cardBtn(p, 1, "orient", "landscape");
  await cardBtn(p, 2, "fit", "width");
  await cardBtn(p, 0, "spread");
  await click(p, '#content button[data-v="ebook"]');
  await cardBtn(p, 2, "cols", "2");
  await p.selectOption("#ebookPt", "16");
  await click(p, '#units button[data-v="cm"]');
  await click(p, '#mode button[data-v="arrange"]');
  await p.focus('#stage .scr[data-i="1"]'); await p.keyboard.press("Shift+ArrowDown"); await p.keyboard.press("Shift+ArrowRight");
  const snap = async pg => ({ cards: await cards(pg), outlines: await outlines(pg), pressed: await pg.$$eval(".seg[id] button[aria-pressed='true']", bs => bs.map(b => b.parentElement.id + "=" + b.dataset.v).sort().join(",")), pt: await pg.$eval("#ebookPt", e => e.value) });
  const want = await snap(p);
  check("setup: three screens in order with different settings", want.cards.map(c => c.name).join(", ") === "iPad mini (A20 Pro, 2026), Galaxy S25 Ultra, Test 13", want.cards.map(c => c.name).join(", "));
  // Reload: everything comes back
  await p.reload(); await p.waitForSelector("#cards .card");
  const back = await snap(p);
  check("after a reload: same screens, order, orientations, settings and positions", JSON.stringify(back) === JSON.stringify(want), diff(want, back));
  // Share link: a new visitor (with none of your screens saved) sees the same thing
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await p.locator("[data-share]").filter({ visible: true }).first().click();
  const link = await p.evaluate(() => navigator.clipboard.readText());
  const other = await open({ custom: [], hash: link.slice(link.indexOf("#")) });
  const got = await snap(other.p);
  check("share link restores screens, order, orientations, per-card fit and columns, settings and arranged positions (to 0.01 in)", JSON.stringify({ ...got, outlines: 0 }) === JSON.stringify({ ...want, outlines: 0 }) && sameSpots(got.outlines, want.outlines), diff(want, got));
  check("your own screen travels in the link", got.cards[2].name === "Test 13" && got.cards[2].ppi === "100");
  check("the address is cleaned up after opening a share link", !(await other.p.evaluate(() => location.hash)));
  noErrors(other.p, "share link");
  await other.ctx.close();
  noErrors(p, "saving");
  await ctx.close();

  // Arranged positions survive a slow device list (your own screens are drawn first, before the list arrives)
  override = pth => pth.endsWith("/devices.csv") ? { delay: 800 } : null;
  const slow = await open({ state: { sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }, { id: "c-tri", uid: "b" }], mode: "arrange", pos: { a: { x: 3, y: 1 }, b: { x: 0, y: 0 } } }, wait: null });
  await slow.p.waitForSelector("#results .res", { timeout: 8000 });
  const pos = await slow.p.evaluate(() => JSON.parse(localStorage.getItem("tss:state")).pos);
  const so = await outlines(slow.p);
  check("free-arrange positions are kept when the device list loads slowly", pos.a && pos.a.x === 3 && pos.a.y === 1 && so.length === 2 && so[0].x > so[1].x, JSON.stringify(pos));
  override = () => null;
  await slow.ctx.close();

  // A link made by an older version (old device and paper names) still opens
  const OLD_LINK = "#s=eyJtb2RlIjoic2lkZSIsIm9yaWVudCI6ImxhbmRzY2FwZSIsInVuaXRzIjoiaW4iLCJwYXBlciI6ImE0IiwicGFwZXJPcmllbnQiOiJwb3J0cmFpdCIsImZpdCI6InBhZ2UiLCJjb250ZW50IjoicGFnZSIsInZpZGVvIjoiMTY6OSIsImVib29rUHQiOjEyLCJzZWwiOlt7ImkiOiJpcGFkLWFpci0xMS1pbmNoLW0yLW0zLW00IiwiZiI6MX0seyJpIjoibWFjYm9vay1haXItMTMtbTItbTMtbTQiLCJ0Ijoid2lkdGgifV19";
  const old = await open({ custom: [], hash: OLD_LINK });
  let c = await cards(old.p);
  check("an old share link with renamed devices opens them under their new names", c.length === 2 && /^iPad Air 11/.test(c[0].name) && /^MacBook Air 13/.test(c[1].name), c.map(x => x.name).join(", "));
  check("…with its orientation, per-card fit and old page-size name (A4)", c[0].orient === "portrait" && c[1].orient === "landscape" && (await old.p.$eval("#paper", e => e.value)) === "a4-paper" && (await old.p.textContent("#cards .card .pdfbox strong")).startsWith("A4"));
  noErrors(old.p, "old share link");
  await old.ctx.close();

  // Saved settings from an older version: old IDs, old page name, keys that didn't exist yet
  const o2 = await open({ custom: [], state: { sel: [{ id: "surface-laptop-3-4-5-15" }, { id: "macbook-pro-16-m1-to-m4", flip: true }], mode: "side", paper: "letter", content: "page", fit: "width", zoom: 50 } });
  c = await cards(o2.p);
  check("settings saved by an older version still load (renamed devices, old page name, missing newer settings)", c.length === 2 && /^Surface Laptop/.test(c[0].name) && /^MacBook Pro 16/.test(c[1].name) && (await o2.p.$eval("#paper", e => e.value)) === "us-letter-paper", c.map(x => x.name).join(", "));
  noErrors(o2.p, "older saved settings");
  await o2.ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function malformed() {
  section("Broken or tampered saved settings");
  const b64 = o => "#s=" + Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
  const cases = [
    ["saved settings that aren't JSON", { raw: { "tss:state": "{not json" } }],
    ["saved settings that are just a string", { raw: { "tss:state": "\"hello\"" } }],
    ["a screen list that isn't a list", { raw: { "tss:state": JSON.stringify({ sel: "oops" }) } }],
    ["empty and broken entries in the screen list", { raw: { "tss:state": JSON.stringify({ sel: [null, { id: 42 }, { uid: "x" }, { id: "ipad-mini-a20-pro-2026" }] }) } }],
    ["missing positions in free arrange", { raw: { "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], mode: "arrange", pos: null, zo: null }) } }],
    ["unknown modes and settings", { raw: { "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], mode: "zigzag", content: "hologram", fit: "huge", video: "99:1", site: "nope", units: "furlongs" }) } }],
    ["a text size that isn't a number", { raw: { "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], content: "ebook", ebookPt: "big" }) } }],
    ["your screens saved as something that isn't a list", { custom: null, raw: { "tss:custom": JSON.stringify({ oops: 1 }) } }],
    ["a broken entry among your screens", { custom: null, raw: { "tss:custom": JSON.stringify([null, { id: "c-bad", n: "Bad", c: "custom", d: -1, w: 0, h: 0 }, TEST13]), "tss:state": JSON.stringify({ sel: [{ id: "c-bad", uid: "a" }, { id: "c-tri", uid: "b" }] }) } }],
    ["a calibration that isn't a number", { raw: { "tss:ppiCal": "\"abc\"", "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], scale: "actual" }) } }],
    ["a calibration far out of range", { raw: { "tss:ppiCal": "1e9", "tss:ppiCalDpr": "\"x\"", "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], scale: "actual" }) } }],
    ["a zoom that isn't a number", { raw: { "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], scale: "manual", zoom: "abc" }) } }],
    ["a zoom of zero", { raw: { "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], scale: "manual", zoom: 0 }) } }],
    ["a huge zoom", { raw: { "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], scale: "manual", zoom: 1e9 }) } }],
    ["an unknown scale", { raw: { "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], scale: "huge", zoom: 50 }) } }],
    ["a negative calibration", { raw: { "tss:ppiCal": "-5", "tss:state": JSON.stringify({ sel: [{ id: "ipad-mini-a20-pro-2026", uid: "a" }], scale: "actual" }) } }],
    ["a share link that isn't valid", { hash: "#s=%%%not-base64" }],
    ["a share link with a screen list that isn't a list", { hash: b64({ sel: 5 }) }],
    ["a share link to a screen that doesn't exist", { hash: b64({ sel: [{ i: "no-such-device" }, { i: "ipad-mini-a20-pro-2026" }] }) }],
    ["a share link with a tiny text size", { hash: b64({ sel: [{ i: "ipad-mini-a20-pro-2026" }], content: "ebook", ebookPt: 0.01 }) }],
  ];
  for (const [what, opts] of cases) {
    const t0 = Date.now();
    const { ctx, p } = await open({ custom: [], ...opts, wait: null });
    const ok = await p.waitForSelector("#results .res", { timeout: 8000 }).then(() => true, () => false);
    const svg = await p.$eval("#stage", e => e.innerHTML).catch(() => "");
    const usable = ok && !/NaN|Infinity/.test(svg) && await p.locator("#q").isEditable();
    const ms = Date.now() - t0;
    check(`${what}: the page still works`, usable && p.errors.length === 0 && ms < 6000, (!ok ? "device list never appeared; " : "") + (/NaN|Infinity/.test(svg) ? "drawing has NaN; " : "") + p.errors.slice(0, 2).join(" | ") + (ms >= 6000 ? ` took ${ms} ms` : ""));
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------------------------------------
async function calibration() {
  section("Calibration");
  const note = p => p.textContent("#scale-note");
  const card = p => p.$eval("#cal-card", e => { const r = e.getBoundingClientRect(); return { w: parseFloat(e.style.width), h: parseFloat(e.style.height), bw: r.width, bh: r.height, left: r.left, right: r.right, text: e.textContent }; });
  const mm = (v, ppi) => v / 25.4 * ppi;
  let { ctx, p } = await open({ state: { sel: sel("c-tri"), content: "page", scale: "fit" } });
  await click(p, "#cal-btn");
  let c = await card(p);
  check("the card is a bank card, 85.60 × 53.98 mm, lying sideways at the default 96 px per inch", near(c.w, mm(85.6, 96), 0.002) && near(c.h, mm(53.98, 96), 0.002) && near(c.bw, c.w, 0.05) && near(c.bh, c.h, 0.05) && /85\.60 × 53\.98 mm/.test(c.text), JSON.stringify(c));
  check("before calibrating, the note doesn't claim a percentage of actual size", !/actual size/.test(await note(p)), await note(p));
  await setRange(p, "#cal-range", 120);
  await click(p, "#cal-plus"); await click(p, "#cal-plus"); await click(p, "#cal-minus");
  check("+ and − change the calibration in half steps and save it", await p.$eval("#cal-range", e => e.value) === "120.5" && await p.evaluate(() => localStorage.getItem("tss:ppiCal")) === "120.5" && /120\.5 px per inch/.test(await p.textContent("#cal-val")));
  check("the drawing scale knows the calibration while on Fit (\"% of actual size\")", /1 inch = (\d+) px on your screen, (\d+)% of actual size/.test(await note(p)), await note(p));
  const fitNote = (await note(p)).match(/1 inch = (\d+) px.*?(\d+)% of actual/);
  if (fitNote) check("and the percentage is the drawing scale ÷ the calibration", Math.abs(+fitNote[2] - +fitNote[1] / 120.5 * 100) <= 1, fitNote[0]);
  await setRange(p, "#cal-range", 96);
  await click(p, '#scaleMode button[data-v="actual"]');
  check("calibrating to exactly 96 px per inch counts as calibrated", /96 screen pixels per inch \(calibrated\)/.test(await note(p)), await note(p));
  await setRange(p, "#cal-range", 250);
  check("the zoom slider shows the actual-size scale, even at 250 px per inch", await p.$eval("#zoom", e => e.value) === "250");
  await setRange(p, "#zoom", 125);
  check("zooming from actual size says how big that is compared with actual size (125 ÷ 250 = 50%)", /1 inch = 125 px on your screen, 50% of actual size/.test(await note(p)), await note(p));
  // Every content mode draws the whole picture, outlines and content, at the calibrated scale
  await setRange(p, "#cal-range", 120);
  for (const content of ["page", "video", "ebook", "site", "none"]) {
    await click(p, `#content button[data-v="${content}"]`);
    await setRange(p, "#zoom", 60);
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    // the content's size on screen: everything inside the screen except its background
    const box = () => p.$eval("#stage .scr", g => {
      const r = g.querySelector("rect"), c = g.querySelector("g[clip-path]"), kids = c ? [...c.children] : [];
      const bs = (kids.length > 1 ? kids.slice(1) : kids).map(k => k.getBoundingClientRect()).filter(b => b.width || b.height);
      const L = Math.min(...bs.map(b => b.left)), R = Math.max(...bs.map(b => b.right)), T = Math.min(...bs.map(b => b.top)), B = Math.max(...bs.map(b => b.bottom));
      return { w: +r.getAttribute("width"), h: +r.getAttribute("height"), cw: bs.length ? R - L : 0, ch: bs.length ? B - T : 0 };
    });
    const half = await box(), stats = statsOnly(await cards(p));
    await click(p, '#scaleMode button[data-v="actual"]');
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); // let a resize redraw finish
    const full = await box();
    const ok = near(full.w, 600, 0.05) && near(full.w / half.w, 2, 0.002) && near(full.h / half.h, 2, 0.002) && (content === "none" || (near(full.cw / half.cw, 2, 0.04) && near(full.ch / half.ch, 2, 0.04)));
    check(`"${content}" mode: actual size draws outline and content at 120 px per inch (twice zoom 60), card numbers unchanged`, ok && statsOnly(await cards(p)) === stats, JSON.stringify({ half, full }));
  }
  await click(p, '#content button[data-v="page"]');
  // Closing the browser and coming back keeps the calibration
  const storageState = await ctx.storageState();
  await ctx.close();
  ctx = await browser.newContext({ storageState, viewport: { width: 1280, height: 800 } });
  await ctx.route(url => !url.href.startsWith(base), r => r.abort());
  p = await ctx.newPage(); p.errors = []; p.on("pageerror", e => p.errors.push(e.message));
  await p.goto(base); await p.waitForSelector("#cards .card");
  check("a new browser session keeps the calibration and actual size (5 in → 600 px)", near((await outlines(p))[0].w, 600, 0.05) && /120 screen pixels per inch \(calibrated\)/.test(await note(p)), await note(p));
  noErrors(p, "calibration");
  await ctx.close();

  // Settings saved before this change (a plain number, no zoom record) still count as calibrated
  ({ ctx, p } = await open({ state: { sel: sel("c-tri"), scale: "actual" }, ppiCal: 132.5 }));
  check("an older saved calibration still works (132.5 px per inch, 5 in → 662.5 px)", near((await outlines(p))[0].w, 662.5, 0.05) && /132\.5 screen pixels per inch \(calibrated\)/.test(await note(p)), await note(p));
  await ctx.close();
  ({ ctx, p } = await open({ state: { sel: sel("c-tri"), scale: "actual" }, raw: { "tss:ppiCal": "300" } }));
  check("a saved calibration outside the slider's range is ignored, and the note says it's the default", near((await outlines(p))[0].w, 480, 0.05) && /96 screen pixels per inch \(default/.test(await note(p)), await note(p));
  await ctx.close();

  // Browser zoom or display scaling changed since calibrating
  ({ ctx, p } = await open({ state: { sel: sel("c-tri"), scale: "actual" }, raw: { "tss:ppiCal": "120", "tss:ppiCalDpr": "1" }, ctxOptions: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } }));
  check("if the browser zoom or display changed since calibrating, the note asks to calibrate again", /calibrate again/.test(await note(p)) && near((await outlines(p))[0].w, 600, 0.05), await note(p));
  await click(p, "#cal-btn"); await click(p, "#cal-done");
  check("pressing Done on the calibration confirms it for the current zoom", /120 screen pixels per inch \(calibrated\)/.test(await note(p)) && await p.evaluate(() => localStorage.getItem("tss:ppiCalDpr")) === "2", await note(p));
  await ctx.close();

  // On a phone the card is shown upright, at full size, inside the screen
  ({ ctx, p } = await open({ state: { sel: sel("c-tri") }, ppiCal: 153, ctxOptions: { ...devices["iPhone 13"] } }));
  await p.tap("#cal-btn");
  await p.locator("#cal-card").scrollIntoViewIfNeeded();
  c = await card(p);
  check("iPhone 13 at 153 px per inch: the card is upright, 53.98 × 85.60 mm, not squeezed", near(c.w, mm(53.98, 153), 0.002) && near(c.h, mm(85.6, 153), 0.002) && near(c.bw, c.w, 0.05) && /upright/.test(c.text), JSON.stringify(c));
  check("and all of it is on screen", c.left >= 0 && c.right <= 390, `${c.left} to ${c.right}`);
  const sizes = await p.$$eval("#cal-minus, #cal-plus", bs => bs.map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  check("the − and + buttons are at least 44 px for fingers", sizes.length === 2 && sizes.every(v => v >= 44), sizes.join(", "));
  await p.tap("#cal-plus");
  check("tapping + saves 153.5 px per inch", await p.evaluate(() => localStorage.getItem("tss:ppiCal")) === "153.5");
  noErrors(p, "calibration on iPhone");
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function devicesById() {
  section("Picking devices");
  const { ctx, p } = await open({ state: { sel: [] }, custom: [], wait: "#results .res" });
  const pairs = [["Galaxy S26+", "Galaxy S26"], ["Galaxy Tab S9+", "Galaxy Tab S9"], ["Galaxy Tab S9 FE+", "Galaxy Tab S9 FE"]];
  for (const [plus, base] of pairs) {
    await p.fill("#q", base);
    for (const n of [base, plus]) await p.locator("#results .res").filter({ has: p.locator(`span:text-is("${n}")`) }).first().click();
    const names = (await cards(p)).map(c => c.name);
    check(`"${base}" and "${plus}" can be compared side by side`, names.includes(base) && names.includes(plus), names.join(", "));
    while (await p.locator('#cards [data-act="remove"]').count()) await p.click('#cards [data-act="remove"]');
  }
  noErrors(p, "picking devices");
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function failures() {
  section("When something can't load");
  override = pth => pth.endsWith("/devices.csv") ? { status: 404 } : null;
  const { ctx, p } = await open({ state: { sel: sel("c-tri") }, wait: null });
  await p.waitForFunction(() => /didn't load/.test(document.querySelector("#results").textContent), null, { timeout: 8000 }).catch(() => {});
  check("if the device list can't load, the device list says so", /The built-in device list didn't load/.test(await p.textContent("#results")), await p.textContent("#results"));
  await p.waitForSelector("#cards .card", { timeout: 3000 }).catch(() => {});
  check("…and your own screens still work", (await cards(p)).some(c => c.name === "Test 13"));
  p.errors = p.errors.filter(e => !/devices\.csv 404/.test(e)); // logged on purpose
  noErrors(p, "missing device list");
  await ctx.close();
  override = () => null;
}

// ---------------------------------------------------------------------------------------------------------
async function serviceWorkerUpdate() {
  section("Offline saving across an update");
  const { ctx, p } = await open({ state: { sel: sel("c-tri") } });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload(); await p.waitForSelector("#cards .card");
  await p.evaluate(async () => { for (const n of ["tss-core-v0", "tss-pdfjs-1.0.0", "another-site"]) await (await caches.open(n)).put("/x", new Response("old")); });
  const keys = () => p.evaluate(async () => (await caches.keys()).sort());
  // The server now has a newer sw.js
  override = pth => pth.endsWith("/sw.js") ? { body: require("fs").readFileSync(path.join(ROOT, "sw.js"), "utf8").replace(/const VERSION = "[^"]+"/, 'const VERSION = "v-test-update"'), type: "text/javascript" } : null;
  await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update();
    const w = reg.installing || reg.waiting;
    if (w && w.state !== "activated") await new Promise(r => w.addEventListener("statechange", () => w.state === "activated" && r()));
  });
  await p.waitForTimeout(300);
  const k = await keys();
  check("an update deletes the old version's saved files and keeps other sites' ones", k.includes("tss-core-v-test-update") && !k.includes("tss-core-v0") && !k.includes("tss-pdfjs-1.0.0") && !k.includes("tss-core-v2") && k.includes("another-site"), k.join(", "));
  await ctx.setOffline(true);
  await p.reload();
  const off = await p.waitForSelector("#cards .card", { timeout: 8000 }).then(() => true, () => false);
  check("after the update the app still opens offline, with your screens", off && (await cards(p)).some(c => c.name === "Test 13"));
  check("…and the full device list", (await p.locator("#results .res").count()) > 200);
  await ctx.setOffline(false);
  override = () => null;
  noErrors(p, "update");
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------------------
async function reference() {
  section("Reference screen");
  // Big 26 is Test 13 doubled: 10 × 24 in upright, also 100 PPI
  const BIG = { id: "c-big", n: "Big 26", c: "custom", d: 26, w: 2400, h: 1000 };
  const custom = [...CUSTOM, BIG];
  const { ctx, p } = await open({ custom, state: { sel: sel("c-tri", "c-big", "c-low", "c-shape"), content: "none" } });
  const panel = () => p.$eval("#ref-panel", e => !e.hidden);
  const refCards = () => p.$$eval("#cards .card.is-ref h3", hs => hs.map(h => h.firstChild.textContent));
  // The table as shown: { head: [...], rows: [{ name, color, ref, cells: [[value, difference], ...] }] }
  const table = () => p.$eval("#ref-panel", box => box.hidden ? null : {
    title: box.querySelector("h2").textContent,
    head: [...box.querySelectorAll("thead th")].slice(1).map(t => t.textContent),
    rows: [...box.querySelectorAll("tbody tr")].map(tr => ({
      name: tr.querySelector(".rn").firstChild.textContent, orientation: tr.querySelector(".ref-orientation").textContent, ref: tr.classList.contains("is-ref"),
      color: getComputedStyle(tr.querySelector(".swatch")).color,
      cells: [...tr.querySelectorAll("td")].map(td => [td.querySelector(".rv").textContent, (td.querySelector(".rd") || { textContent: "" }).textContent]),
    })),
  });
  const col = (t, name) => t.rows.map(r => r.cells[t.head.indexOf(name)]);
  check("no reference by default: no table, no marked card", !(await panel()) && (await refCards()).length === 0);
  check("every card has a Set as reference button", (await p.locator('#cards [data-act="ref"]').count()) === 4 && (await p.textContent('#cards [data-act="ref"][data-i="0"]')) === "Set as reference");

  await cardBtn(p, 0, "ref");
  let t = await table();
  check("setting Test 13 as the reference marks its card and shows the table", (await refCards()).join() === "Test 13" && t && t.title === "Compared with Test 13" && (await p.textContent('#cards [data-act="ref"][data-i="0"]')) === "Clear reference");
  check("screen mode includes native resolution and aspect ratio", t.head.join("|") === "Width|Height|Diagonal|Area|PPI|Megapixels|Native resolution|Aspect ratio", t.head.join("|"));
  check("rows follow the card order, show orientation and identify the reference", t.rows.map(r => r.name).join() === "Test 13,Big 26,Low 13,Shape only" && t.rows[0].ref && t.rows.filter(r => r.ref).length === 1 && t.rows.every(r => r.orientation === "Portrait"));
  const cardColors = await p.$$eval("#cards .card", cs => cs.map(c => getComputedStyle(c).color));
  check("each row uses its screen's color", t.rows.every((r, k) => r.color === cardColors[k]) && new Set(cardColors).size === 4, JSON.stringify(t.rows.map(r => r.color)));
  check("the reference row is the baseline", t.rows[0].cells.every((c, i) => c[1] === (t.head[i] === "Native resolution" ? "" : "baseline")) && t.rows[0].cells[0][0] === "5.00″");
  check("twice the size: +100% width, height and diagonal, +300% area, same PPI (0%), four times the megapixels (+300%)", JSON.stringify(t.rows[1].cells.slice(0, 6)) === JSON.stringify([["10.00″", "+100%"], ["24.00″", "+100%"], ["26″", "+100%"], ["240.0 sq in", "+300%"], ["100", "0%"], ["2.40", "+300%"]]), JSON.stringify(t.rows[1].cells));
  check("half the pixels: same size (0%), −50% PPI with a real minus sign, a quarter of the megapixels (−75%)", JSON.stringify(t.rows[2].cells.slice(0, 6).map(c => c[1])) === JSON.stringify(["0%", "0%", "0%", "0%", "−50%", "−75%"]), JSON.stringify(t.rows[2].cells));
  check("a screen with no pixel count shows a dash for PPI and megapixels, not 0 or −100%", JSON.stringify(t.rows[3].cells[4]) === JSON.stringify(["–", ""]) && JSON.stringify(t.rows[3].cells[5]) === JSON.stringify(["–", ""]) && t.rows[3].cells[0][1] === "0%");
  check("native resolution shows dimensions without repeating the megapixel difference, and aspect ratio works without pixels", JSON.stringify(col(t, "Native resolution")) === JSON.stringify([["500 × 1200", ""], ["1000 × 2400", ""], ["250 × 600", ""], ["–", ""]]) && col(t, "Aspect ratio").every(c => c[0] !== "–") && col(t, "Aspect ratio")[1][1] === "0%");
  const signsColored = await p.$$eval("#ref-panel .rd", cells => cells.every(cell => {
    const text = cell.textContent;
    return cell.classList.contains("positive") === text.startsWith("+")
      && cell.classList.contains("negative") === text.startsWith("−");
  }));
  check("only signed reference percentages get a color class", signsColored);
  const c = await cards(p);
  check("table values match the cards", t.rows.every((r, k) => r.cells[0][0] + " × " + r.cells[1][0] === c[k]["Screen size"] && r.cells[2][0] === c[k]["Diagonal"] && r.cells[3][0] === c[k]["Area"] && (c[k]["Megapixels"] ? r.cells[5][0] + " MP" === c[k]["Megapixels"] : r.cells[5][0] === "–")));
  await cardBtn(p, 1, "orient", "landscape");
  check("turning a screen doesn't change its megapixels or their percentage", JSON.stringify((await table()).rows[1].cells[5]) === JSON.stringify(["2.40", "+300%"]));
  await cardBtn(p, 1, "orient", "portrait");

  // One reference at a time; clear it, choose another
  await cardBtn(p, 1, "ref");
  t = await table();
  check("choosing another screen moves the reference (only one at a time)", (await refCards()).join() === "Big 26" && t.title === "Compared with Big 26" && t.rows.filter(r => r.ref).map(r => r.name).join() === "Big 26" && col(t, "Area")[0][1] === "−75%", JSON.stringify(col(t, "Area")));
  await cardBtn(p, 1, "ref");
  check("Clear reference hides the table", !(await panel()) && (await refCards()).length === 0);
  // Keyboard: the button works with Enter and keeps focus
  await p.focus('#cards [data-act="ref"][data-i="0"]'); await p.keyboard.press("Enter");
  const foc = await p.evaluate(() => { const a = document.activeElement; return a && a.dataset.act + a.dataset.i + a.textContent; });
  check("keyboard: Enter sets the reference, focus stays on the button, and it's announced", (await refCards()).join() === "Test 13" && foc === "ref0Clear reference" && /Test 13 is now the reference/.test(await p.textContent("#sr-live")), foc);

  // The table follows every change at once
  await cardBtn(p, 1, "orient", "landscape");
  t = await table();
  check("turning a screen updates its row (Big 26 landscape: 24.00″ wide, +380%)", t.rows[1].orientation === "Landscape" && t.rows[0].orientation === "Portrait" && JSON.stringify(t.rows[1].cells[0]) === JSON.stringify(["24.00″", "+380%"]), JSON.stringify(t.rows[1].cells[0]));
  await cardBtn(p, 1, "orient", "portrait");
  await click(p, '#units button[data-v="cm"]');
  t = await table();
  check("centimeters: 12.7 cm wide, 387 cm², percentages unchanged", t.rows[0].cells[0][0] === "12.7 cm" && t.rows[0].cells[3][0] === "387 cm²" && t.rows[1].cells[3][1] === "+300%");
  await click(p, '#units button[data-v="in"]');
  const modes = {
    page: "12 pt text · Fit page|12 pt text · Fit width|Page or spread visible at once",
    video: "Screen used · 16:9|Screen used · 2.39:1|Screen used · 4:3|Screen used · 9:16",
    ebook: "Words per screen|Characters per line|Lines per screen|Columns",
    site: "Browser width (CSS px)|Browser height (CSS px)|Estimated display scaling|16 CSS px body text|Layout",
  };
  const tabs = p.getByRole("tablist", { name: "Reference comparison modes" });
  const activeTab = () => tabs.getByRole("tab", { selected: true });
  const previewCards = await cards(p);
  check("all comparison tabs are available before visiting the preview modes", (await tabs.getByRole("tab").allTextContents()).join("|") === "Screen size|Pages|Video|E-book|Website" && await activeTab().textContent() === "Screen size");
  const tabTables = {};
  for (const m of Object.keys(modes)) {
    await p.locator(`#ref-tab-${m}`).click();
    tabTables[m] = await table();
  }
  check("opening comparison tabs leaves the preview and cards alone", await p.getAttribute('#content button[data-v="none"]', "aria-pressed") === "true" && JSON.stringify(await cards(p)) === JSON.stringify(previewCards));
  await p.keyboard.press("ArrowRight");
  check("the tabs wrap by keyboard and keep focus on the selected tab", await activeTab().textContent() === "Screen size" && await activeTab().evaluate(tab => tab === document.activeElement) && await p.getByRole("tabpanel").count() === 1);
  for (const [m, head] of Object.entries(modes)) {
    await click(p, `#content button[data-v="${m}"]`);
    t = await table();
    const cs = await cards(p);
    let same;
    if (m === "page") same = t.rows.every((r, k) => r.cells[0][0] === cs[k]["12 pt text looks like"] && r.cells[2][0] === cs[k]["Page visible at once"]);
    if (m === "video") same = t.rows.every((r, k) => r.cells[0][0] + " of screen" === cs[k]["Picture uses"]);
    if (m === "ebook") same = t.rows.every((r, k) => "about " + r.cells[0][0] === cs[k]["Words per screen"] && "about " + r.cells[1][0] === cs[k]["Characters per line"] && r.cells[2][0] === cs[k]["Lines per screen"] && r.cells[3][0] === cs[k]["Columns"]);
    if (m === "site") same = t.rows.every((r, k) => cs[k]["Browser width"] ? `${r.cells[0][0]} × ${r.cells[1][0]} CSS px` === cs[k]["Browser width"] && cs[k]["Display scaling"].startsWith(r.cells[2][0] + " ") && cs[k]["16 px body text"] === "looks like " + r.cells[3][0] + " print" && r.cells[4][0] === cs[k]["Layout"] && r.cells[4][1] === "" : r.cells.every(c => c[0] === "–"));
    check(`${m} mode: its own columns, same numbers as the cards`, t.head.join("|") === head && same && JSON.stringify(t) === JSON.stringify(tabTables[m]), t.head.join("|") + " " + JSON.stringify(t.rows.map(r => r.cells)));
  }
  await click(p, '#siteLayout button[data-v="desktop"]');
  const forced = await table();
  const websiteCards = await cards(p);
  check("Website reports forced layout and natural layout, as on the cards", /forced, would be/.test(forced.rows[0].cells[4][0]) && forced.rows[0].cells[4][0] === websiteCards[0].Layout);
  await click(p, '#siteLayout button[data-v="auto"]');
  await click(p, '#content button[data-v="video"]');
  t = await table();
  const videoHint = await p.textContent("#ref-panel .hint");
  check("Video explains the coverage value and the signed relative change", /top percentage.*video fills/.test(videoHint) && /\+100% means twice/.test(videoHint));
  check("video coverage compares four fixed ratios on the upright 5 × 12 in screen", JSON.stringify(t.rows[0].cells.map(c => c[0])) === JSON.stringify(["23%", "17%", "31%", "74%"]) && t.rows[1].cells.every(c => c[1] === "0%") && t.rows[3].cells.every(c => c[0] !== "–"));
  const pictureArea = (await cards(p))[0]["Picture area"];
  await p.selectOption("#video", "4:3");
  const otherVideo = await table();
  check("the preview changes the cards' picture dimensions while the Video table stays the same", (await cards(p))[0]["Picture area"] !== pictureArea && JSON.stringify(otherVideo) === JSON.stringify(t));
  await p.selectOption("#video", "16:9");
  await click(p, '#content button[data-v="ebook"]');
  await cardBtn(p, 1, "cols", "2");
  t = await table();
  const ebk = (await cards(p))[1];
  check("e-book: two columns count lines in both, and the note says so", t.rows[1].cells[2][0] === String(2 * +ebk["Lines per column"]) && /count every column/.test(await p.textContent("#ref-panel .hint")), t.rows[1].cells[2][0] + " vs " + ebk["Lines per column"]);
  await p.selectOption("#ebookPt", "20");
  const t2 = await table();
  check("E-book keeps its 12 pt medium comparison when the preview font changes", JSON.stringify(t2) === JSON.stringify(t) && (await cards(p))[0]["Words per screen"] !== "about " + t.rows[0].cells[0][0] && /12 pt \(medium\)/.test(await p.textContent("#ref-panel .hint")));
  await click(p, '#content button[data-v="page"]');
  await cardBtn(p, 1, "orient", "landscape");
  const bothFits = await table();
  check("Letter on 24 × 10 in shows 10.9 pt at Fit page and 33.9 pt at Fit width", bothFits.rows[1].cells[0][0] === "10.9 pt" && bothFits.rows[1].cells[1][0] === "33.9 pt");
  await cardBtn(p, 1, "fit", "width");
  const fitWidth = await table();
  check("changing the selected fit updates visibility and keeps both text sizes", fitWidth.rows[1].cells[2][0] !== bothFits.rows[1].cells[2][0] && JSON.stringify(fitWidth.rows[1].cells.slice(0, 2)) === JSON.stringify(bothFits.rows[1].cells.slice(0, 2)));
  await cardBtn(p, 1, "spread");
  const rowDetails = await p.locator("#ref-panel tbody th small").allTextContents();
  check("Pages identifies each row's page count and selected fit", rowDetails[0].includes("1 page · Fit page") && rowDetails[1].includes("2 pages · Fit width") && /top visibility percentage.*page or spread/.test(await p.textContent("#ref-panel .hint")), rowDetails.join(" | "));
  await cardBtn(p, 1, "fit", "actual");
  check("Pages labels actual-size fit as 100%", (await p.locator("#ref-panel tbody th small").nth(1).textContent()).includes("2 pages · 100%"));
  await cardBtn(p, 1, "single");
  await cardBtn(p, 1, "fit", "page");
  await cardBtn(p, 1, "orient", "portrait");
  await p.selectOption("#paper", "none");
  check("Pages prompts for a page size and Screen size is still available", await activeTab().textContent() === "Pages" && /Choose a page size/.test(await p.getByRole("tabpanel").textContent()) && (await table()).head.length === 0);
  await tabs.getByRole("tab", { name: "Screen size", exact: true }).click();
  check("Screen size still works with no page chosen", (await table()).head[0] === "Width");
  await p.selectOption("#paper", "upload");
  await tabs.getByRole("tab", { name: "Pages", exact: true }).click();
  check("Pages prompts for a PDF when no file is loaded", /Upload a PDF/.test(await p.getByRole("tabpanel").textContent()) && (await table()).head.length === 0);
  await p.selectOption("#paper", "us-letter-paper");

  // A paper sheet in the comparison has no screen numbers to compare
  await p.fill("#q", "US Letter"); await p.locator("#results .res").first().click(); await p.fill("#q", "");
  t = await table();
  check("a paper sheet's row shows dashes in Pages mode", t.rows[4].cells.every(c => c[0] === "–"), JSON.stringify(t.rows[4]));

  // Saving, share links, duplicating and removing
  await p.reload(); await p.waitForSelector("#cards .card");
  check("the reference is remembered after a reload", (await refCards()).join() === "Test 13" && await panel());
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await p.locator("[data-share]").filter({ visible: true }).first().click();
  const link = await p.evaluate(() => navigator.clipboard.readText());
  const other = await open({ custom: [], hash: link.slice(link.indexOf("#")) });
  check("a share link carries the reference", (await other.p.$$eval("#cards .card.is-ref h3", hs => hs.map(h => h.firstChild.textContent))).join() === "Test 13" && await other.p.$eval("#ref-panel", e => !e.hidden));
  noErrors(other.p, "reference share link");
  await other.ctx.close();
  await cardBtn(p, 0, "dup");
  check("duplicating the reference screen doesn't make a second reference", (await refCards()).length === 1 && (await p.locator("#cards .card").count()) === 6);
  await cardBtn(p, 1, "remove");
  await cardBtn(p, 0, "remove");
  check("removing the reference screen clears the reference and hides the table", (await refCards()).length === 0 && !(await panel()));
  await p.reload(); await p.waitForSelector("#cards .card");
  check("…and it stays cleared after a reload", (await refCards()).length === 0 && !(await panel()));
  // Taking it off through the device list works the same way
  await cardBtn(p, 0, "ref");
  const first = (await cards(p))[0].name;
  await p.fill("#q", first); await p.locator(`#results .res[aria-pressed="true"]`).first().click(); await p.fill("#q", "");
  check("removing the reference from the device list clears it too", (await refCards()).length === 0 && !(await panel()) && !(await cards(p)).some(x => x.name === first));
  // With one screen left the table hides, but the choice is kept
  while ((await p.locator("#cards .card").count()) > 2) await cardBtn(p, 2, "remove");
  await cardBtn(p, 0, "ref");
  await cardBtn(p, 1, "remove");
  check("with only the reference left, the card stays marked and the table and shortcut hide", (await refCards()).length === 1 && !(await panel()) && !await p.getByRole("button", { name: "View comparison" }).isVisible());
  await p.fill("#q", "Twin 13"); await p.locator("#results .res").first().click(); await p.fill("#q", "");
  check("adding another screen brings the table back", await panel() && (await table()).rows.length === 2);
  await click(p, "#reset-btn");
  check("Reset to start clears the reference", (await refCards()).length === 0 && !(await panel()));
  await p.reload(); await p.waitForSelector("#cards .card");
  check("…and after a reload", (await refCards()).length === 0);
  noErrors(p, "reference");
  await ctx.close();

  // Older links and saved settings have no reference: they open without one
  const b64 = o => "#s=" + Buffer.from(JSON.stringify(o)).toString("base64url");
  const old = await open({ custom: [], hash: b64({ content: "none", sel: [{ i: "ipad-mini-a20-pro-2026" }, { i: "ipad-pro-11-inch-m4-m5" }] }) });
  check("a share link from before this feature opens with no reference", (await old.p.locator("#cards .card.is-ref").count()) === 0 && await old.p.$eval("#ref-panel", e => e.hidden));
  noErrors(old.p, "old link");
  await old.ctx.close();
  const two = await open({ custom: [], hash: b64({ sel: [{ i: "ipad-mini-a20-pro-2026", r: 1 }, { i: "ipad-pro-11-inch-m4-m5", r: 1 }] }) });
  check("a link marking two references keeps only the first", (await two.p.$$eval("#cards .card.is-ref", cs => cs.map(c => c.dataset.i))).join() === "0");
  await two.ctx.close();
  for (const [what, state] of [["a reference to a screen that isn't there", { sel: sel("c-tri", "c-low"), ref: "nope" }], ["a reference that isn't text", { sel: sel("c-tri", "c-low"), ref: { x: 1 } }]]) {
    const o = await open({ state });
    check(`saved settings with ${what}: no reference, no errors`, (await o.p.locator("#cards .card.is-ref").count()) === 0 && await o.p.$eval("#ref-panel", e => e.hidden) && o.p.errors.length === 0, o.p.errors.join(" | "));
    await o.ctx.close();
  }
  for (const [width, ids] of [[320, ["c-tri", "c-shape"]], [390, ["c-tri", "c-big", "c-low", "c-shape"]]]) {
    const phone = devices["iPhone 13"];
    const { ctx: mobile, p: page } = await open({
      custom, state: { sel: sel(...ids), content: "none" },
      ctxOptions: { ...phone, viewport: { ...phone.viewport, width }, screen: { ...phone.screen, width } },
    });
    const refButton = page.locator('#cards [data-act="ref"]').first();
    await refButton.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await refButton.click();
    const shortcut = page.getByRole("button", { name: "View comparison" });
    check(`${width} px: reference confirmation appears without scrolling`, await page.getByText("Reference selected", { exact: true }).isVisible() && await shortcut.isVisible() && Math.abs(await page.evaluate(() => scrollY) - before) <= 1);
    await refButton.press("Tab");
    check(`${width} px: Tab reaches View comparison`, await shortcut.evaluate(b => b === document.activeElement));
    await shortcut.press("Enter");
    const heading = await page.locator("#ref-title").evaluate(h => ({ focused: document.activeElement === h, top: h.getBoundingClientRect().top, bar: document.querySelector("#quickbar").getBoundingClientRect().bottom, viewport: innerHeight }));
    check(`${width} px: shortcut focuses the heading below the quick controls`, heading.focused && heading.top >= heading.bar && heading.top < heading.viewport, JSON.stringify(heading));
    const overflow = page.getByText("Scroll sideways to see more columns.");
    await overflow.waitFor();
    const table = await page.locator(".ref-scroll").evaluate(el => {
      el.scrollLeft = el.scrollWidth;
      return { rows: el.querySelectorAll("tbody tr").length, missing: !!el.querySelector("td .sr-only"), scroll: el.scrollLeft, pageOverflow: document.documentElement.scrollWidth - innerWidth };
    });
    check(`${width} px: ${ids.length} rows, including unavailable values, scroll inside the table`, await overflow.isVisible() && table.rows === ids.length && table.missing && table.scroll > 0 && table.pageOverflow <= 0, JSON.stringify(table));
    await mobile.close();
  }
  // On an iPhone: the table scrolls inside its box, never the page
  const ph = await open({ custom, state: { sel: sel("c-tri", "c-big", "c-low", "c-shape"), content: "none", ref: "t0" }, ctxOptions: { ...devices["iPhone 13"] } });
  const over = await ph.p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const btnH = await ph.p.$eval('#cards [data-act="ref"]', b => b.getBoundingClientRect().height);
  check("iPhone 13: saved reference shows, the table doesn't widen the page, and the button is finger-sized", await ph.p.$eval("#ref-panel", e => !e.hidden) && over <= 0 && btnH >= 38, `${over} px too wide, button ${btnH} px`);
  noErrors(ph.p, "reference on iPhone");
  await ph.ctx.close();

  for (const width of [320, 390]) {
    const phone = devices["iPhone 13"];
    const { ctx: mobile, p: page } = await open({
      custom, state: { sel: sel("c-tri", "c-shape", "us-letter-paper"), content: "none", ref: "t0" },
      ctxOptions: { ...phone, viewport: { ...phone.viewport, width }, screen: { ...phone.screen, width } },
    });
    await mobile.addInitScript(() => { delete Object.hasOwn; });
    await page.reload();
    await page.waitForSelector("#ref-tab-screen");
    for (const tab of ["screen", "site"]) {
      if (tab === "site") await page.locator("#ref-tab-screen").press("End");
      const metrics = await page.locator(`#ref-view-${tab} .ref-scroll`).evaluate(box => {
        box.scrollLeft = box.scrollWidth;
        return {
          unavailable: box.querySelectorAll("td .sr-only").length,
          pageOverflow: document.documentElement.scrollWidth - innerWidth,
          tableScroll: box.scrollLeft,
        };
      });
      check(`${width} px, ${tab}: missing values stay inside a scrollable table`, metrics.unavailable > 0 && metrics.pageOverflow <= 0 && metrics.tableScroll > 0, JSON.stringify(metrics));
    }
    noErrors(page, `${width} px with Object.hasOwn unavailable`);
    await mobile.close();
  }
}

(async () => {
  const server = await serve(ROOT, pth => override(pth));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
  const ALL = [geometry, customForm, myScreenMatching, pages, pdfs, video, () => ebook({ viewport: { width: 1280, height: 800 } }, ""), () => ebook({ ...devices["iPhone 13"] }, " (iPhone 13)"), website, persistence, reference, calibration, malformed, devicesById, failures, serviceWorkerUpdate];
  const only = (process.env.ONLY || "").split(",").filter(Boolean);
  // Named steps match by exact name; the two unnamed e-book wrappers match on their text ("ebook")
  const steps = only.length ? ALL.filter(f => f.name ? only.includes(f.name) : only.some(o => f.toString().includes(o))) : ALL;
  for (const step of steps) {
    try { await step(); }
    catch (e) { check(`${step.name || "step"} crashed: ${e.message.split("\n")[0]}`, false); override = () => null; }
  }
  await browser.close();
  server.close();
  finish();
})();
