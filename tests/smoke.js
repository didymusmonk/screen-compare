// Smoke test for True Size Screens.
// Opens the site in a headless browser (desktop and iPhone sizes) and checks
// that the main features still work. Run it after every change:
//
//   cd tests && npm install && npx playwright install chromium   (first time only)
//   node tests/smoke.js            (from the repo folder)
//
// It starts its own little web server, so nothing else needs to be running.
// Exit code 0 means every check passed; 1 means at least one failed.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");
const { check, section, finish } = require("./lib/check");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".csv": "text/csv", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
let axeSource = null;
try { axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"); } catch (e) { /* axe-core not installed: accessibility check is skipped */ }

// --- tiny helpers -----------------------------------------------------------
function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}
// A one-page 5 × 7 inch PDF, built by hand so the test needs no sample file.
function tinyPdf() {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 504] >>",
  ];
  let out = "%PDF-1.4\n";
  const offs = objs.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
// A PDF built by hand from a list of pages: { w, h } in points plus drawing commands.
function makePdf(pages) {
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", ""];
  const kids = [];
  for (const pg of pages) {
    const page = objs.length + 1, stream = page + 1;
    kids.push(`${page} 0 R`);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pg.w} ${pg.h}] /Contents ${stream} 0 R >>`);
    objs.push(`<< /Length ${pg.draw.length} >>\nstream\n${pg.draw}\nendstream`);
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  let out = "%PDF-1.4\n";
  const offs = objs.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
// 5 × 7 in scanned-looking page: off-white paper, a text block from 1 to 4 in across and 1 in from the top,
// a page number down to 0.5 in from the bottom, and one speck of dust near the top left corner.
// Content is 3 × 5.5 in, so with the 0.12 in safety margin the crop should be 3.24 × 5.74 in.
const scanPdf = () => makePdf([{ w: 360, h: 504, draw: "0.95 0.94 0.89 rg 0 0 360 504 re f 0.1 0.1 0.1 rg 72 108 216 324 re f 166 36 28 10 re f 29 475 1 1 re f" }]);
// Two facing pages with mirrored margins: content 1.5–4 in on page 1 and 1–3.5 in on page 2 (2.5 in wide each).
// Cropping each page around its own text gives 2.74 in; one shared crop for both would give 3.24 in.
const bookPdf = () => makePdf([
  { w: 360, h: 504, draw: "0 0 0 rg 108 72 180 360 re f" },
  { w: 360, h: 504, draw: "0 0 0 rg 72 72 180 360 re f" },
]);
const cardCount = p => p.locator("#cards .card").count();
const shapeCount = p => p.locator("#stage svg *").count();

// --- the checks -------------------------------------------------------------
async function run(browser, base, label, ctxOptions) {
  section(label);
  const ctx = await browser.newContext(ctxOptions);
  // Block outside requests (the GoatCounter analytics) so test runs aren't counted as visits
  await ctx.route(url => !url.href.startsWith(base), r => r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(e.message));
  p.on("console", m => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
  const phone = !!ctxOptions.isMobile;

  await p.goto(base);
  await p.waitForSelector("#results .res");
  const devCount = await p.locator("#results .res").count();
  check("device list loads", devCount > 200, devCount + " devices");
  check("first visit shows the two default screens", (await cardCount(p)) === 2);
  check("stage draws the screens", (await shapeCount(p)) > 10);

  const results = () => p.locator("#results .res").evaluateAll(buttons => buttons.map(b => b.dataset.id));
  await p.fill("#q", "SP9");
  check("SP9 finds only Surface Pro 9", (await results()).join() === "surface-pro-9");
  await p.click('#cats [data-k="tablet"]');
  check("the category filter still excludes Surface Pro 9 from Tablets", (await results()).length === 0);
  await p.click('#cats [data-k="all"]');
  await p.fill("#q", "SP1");
  check("SP1 does not match Surface Pro 10 or 12-inch", !(await results()).some(id => /^surface-pro-1[02]/.test(id)));
  await p.fill("#q", "Surface Pro 9");
  check("the full Surface Pro 9 name still finds the same device", (await results()).join() === "surface-pro-9");
  await p.fill("#q", "11-inch iPad Pro");
  check("11-inch iPad Pro finds both generations without the 13-inch model", (await results()).sort().join() === "ipad-pro-11-inch-1st-to-4th-gen,ipad-pro-11-inch-m4-m5");

  // Add and remove a device from the list
  await p.fill("#q", "Surface Pro");
  const hit = p.locator("#results .res").first();
  await hit.click();
  check("clicking a search result adds a screen", (await cardCount(p)) === 3);
  await hit.click();
  check("clicking it again removes it", (await cardCount(p)) === 2);
  await p.fill("#q", "");

  // Content and layout modes (on phones the quickbar holds the content buttons)
  const content = phone ? "#content2" : "#content";
  for (const v of ["video", "ebook", "site", "none", "page"]) {
    await p.click(`${content} button[data-v="${v}"]`);
    check(`content mode "${v}" draws`, (await shapeCount(p)) > 5);
    if (v === "ebook" && !phone) {
      // the cards' word counts match the words drawn, and don't change with the preview's zoom
      const ebookStats = () => p.evaluate(() => {
        const dd = name => [...document.querySelectorAll("#cards dt")].filter(d => d.textContent === name).map(d => d.nextElementSibling.textContent);
        const words = dd("Words per screen").reduce((n, t) => n + +t.replace(/\D/g, ""), 0);
        const drawn = [...document.querySelectorAll("#stage .prose text")].reduce((n, t) => n + t.textContent.split(" ").filter(Boolean).length, 0);
        return { words, drawn, all: [...document.querySelectorAll("#cards dl")].map(d => d.textContent).join("|") };
      });
      const setZoom = z => p.$eval("#zoom", (el, z) => { el.value = z; el.dispatchEvent(new Event("input", { bubbles: true })); }, z);
      await setZoom(120);
      const a = await ebookStats();
      check("e-book word counts match the drawn text", a.words > 100 && a.words === a.drawn, `${a.words} counted, ${a.drawn} drawn`);
      await setZoom(200);
      const b = await ebookStats();
      check("e-book counts don't change with zoom", a.all === b.all && b.words === b.drawn);
      check("e-book cards show capital and x-height", a.all.includes("Capital letter height (px)") && a.all.includes("Lowercase x-height (px)"));
      await setZoom(50);
    }
  }
  for (const v of ["overlay", "arrange", "side"]) {
    await p.click(`#mode button[data-v="${v}"]`);
    check(`layout "${v}" draws`, (await shapeCount(p)) > 5);
  }
  await p.click(`#orient button[data-v="landscape"]`);
  await p.click(`#orient button[data-v="portrait"]`);

  // Share link round trip: a new visitor with the link sees the same screens
  await p.fill("#q", "Pixel");
  await p.locator("#results .res").first().click();
  const names = pg => pg.locator("#cards .card h3").evaluateAll(hs => hs.map(h => h.firstChild.textContent).join(", "));
  const want = await names(p);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await p.selectOption("#paper", "a4-paper");
  await p.locator("[data-share]").filter({ visible: true }).first().click();
  const link = await p.evaluate(() => navigator.clipboard.readText());
  const ctx2 = await browser.newContext(ctxOptions);
  await ctx2.route(url => !url.href.startsWith(base), r => r.abort());
  const p2 = await ctx2.newPage();
  await p2.goto(link);
  await p2.waitForSelector("#cards .card");
  const got = await names(p2);
  check("share link opens the same screens", link.includes("#s=") && got === want, `${want} vs ${got}`);
  check("ordinary paper shares keep the chosen A4 preset", await p2.inputValue("#paper") === "a4-paper" && await p.locator(".pdf-share-note:visible").count() === 0);
  await ctx2.close();

  // PDF preview (loads pdf.js from pdfjs/ on demand)
  await p.click(`${content} button[data-v="page"]`);
  const pdfButton = p.getByRole("button", { name: "Open a PDF" });
  check("Pages shows Open a PDF without loading pdf.js", await pdfButton.isVisible() && await p.evaluate(() => !performance.getEntriesByType("resource").some(e => e.name.includes("/pdfjs/"))));
  const [picker] = await Promise.all([p.waitForEvent("filechooser"), pdfButton.click()]);
  await picker.setFiles({ name: "test.pdf", mimeType: "application/pdf", buffer: tinyPdf() });
  const pdfOk = await p.waitForFunction(() => /5\.00 × 7\.00 in/.test(document.querySelector("#pdf-status").textContent), null, { timeout: 15000 }).then(() => true, () => false);
  check("PDF opens and reports its page size", pdfOk, await p.textContent("#pdf-status"));
  const share = p.locator("[data-share]").filter({ visible: true }).first();
  const note = p.locator("#" + await share.getAttribute("aria-describedby"));
  check("the visible Share control explains the PDF fallback and privacy", await note.isVisible() && /US Letter.*stays on your device/.test(await note.textContent()));
  await share.click();
  const pdfLink = await p.evaluate(() => navigator.clipboard.readText());
  const recipientContext = await browser.newContext(ctxOptions);
  await recipientContext.route(url => !url.href.startsWith(base), r => r.abort());
  const receiver = await recipientContext.newPage();
  await receiver.goto(pdfLink);
  await receiver.waitForSelector("#cards .card");
  check("a recipient gets US Letter and no sender PDF", await receiver.inputValue("#paper") === "us-letter-paper" && await receiver.locator(".pdf-share-note:visible").count() === 0 && await receiver.evaluate(() => !performance.getEntriesByType("resource").some(e => e.name.includes("/pdfjs/"))));
  await recipientContext.close();


  // Crop white margins
  const status = () => p.textContent("#pdf-status");
  const cropped = async () => { await p.waitForFunction(() => /Cropped to|No white margins/.test(document.querySelector("#pdf-status").textContent), null, { timeout: 15000 }).catch(() => {}); const m = /Cropped to ([\d.]+) × ([\d.]+) in/.exec(await status()); return m ? [+m[1], +m[2]] : null; };
  const stats = () => p.evaluate(() => [...document.querySelectorAll("#cards .card")].map(c => {
    const dd = name => { const d = [...c.querySelectorAll("dt")].find(d => d.textContent.endsWith(name)); return d ? d.nextElementSibling.textContent : null; };
    return { pct: parseFloat(dd("Size vs. printed page")), pt: parseFloat(dd("12 pt text looks like")), ppi: parseFloat(dd("Pixels per page inch")), seen: dd("visible at once"),
      label: ([...c.querySelectorAll("dt")].find(d => d.textContent.endsWith("visible at once")) || {}).textContent, tip: ([...c.querySelectorAll("dt")].find(d => d.textContent.endsWith("visible at once")) || { title: "" }).title };
  }));
  const fitAll = v => p.click(`#fit button[data-v="${v}"]`);
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  await p.setInputFiles("#pdf-file", { name: "scan.pdf", mimeType: "application/pdf", buffer: scanPdf() });
  await p.waitForFunction(() => /^scan:/.test(document.querySelector("#pdf-status").textContent), null, { timeout: 15000 });
  check("crop checkbox shows for a PDF, off by default", await p.isVisible("#crop") && !(await p.isChecked("#crop")));
  await fitAll("width");
  const before = await stats();
  await p.check("#crop");
  const box = await cropped();
  check("crop finds the content on an off-white scan, ignoring dust", box && near(box[0], 3.24, 0.08) && near(box[1], 5.74, 0.08), await status());
  const after = await stats();
  check("Fit width zooms in by page width ÷ cropped width", after.every((a, k) => near(a.pct / before[k].pct, 5 / box[0], 0.04)), JSON.stringify([before.map(b => b.pct), after.map(a => a.pct)]));
  check("12 pt text size follows the cropped scale", after.every(a => near(a.pt, 12 * a.pct / 100, 0.15)));
  check("pixels per page inch follow the cropped scale", after.every((a, k) => !a.ppi || near(a.ppi / a.pct, before[k].ppi / before[k].pct, 0.05)));
  check("visible-at-once is labeled for the cropped page", after.every(a => a.label.startsWith("Cropped") && /white margins removed/.test(a.tip)));
  const shape = await p.$$eval("#stage svg.pdf-crop", els => els.map(e => ({ w: +e.getAttribute("width"), h: +e.getAttribute("height"), vb: e.getAttribute("viewBox").split(" ").map(Number) })));
  check("preview shows the cropped page in the same shape", shape.length > 0 && shape.every(s => near(s.w / s.h, box[0] / box[1], 0.01) && near(s.vb[2] / s.vb[3], box[0] / box[1], 0.01)));
  await fitAll("actual");
  const real = await stats();
  const wCrop = await p.$$eval("#stage svg.pdf-crop", els => els.map(e => +e.getAttribute("width")));
  await p.uncheck("#crop");
  const wFull = await p.$$eval("#stage g[clip-path] > image", els => els.map(e => +e.getAttribute("width")));
  check("100% keeps the printed size when cropped", real.every(a => a.pct === 100) && wFull.length === wCrop.length && wCrop.every((w, k) => near(w / wFull[k], box[0] / 5, 0.01)), JSON.stringify([wCrop, wFull]));
  check("unchecking shows the whole page again", !/Cropped/.test(await status()) && (await p.locator("#stage svg.pdf-crop").count()) === 0);
  await fitAll("page");
  await p.setInputFiles("#pdf-file", { name: "book.pdf", mimeType: "application/pdf", buffer: bookPdf() });
  await p.waitForFunction(() => /^book:/.test(document.querySelector("#pdf-status").textContent), null, { timeout: 15000 });
  await p.click('#spreadAll button[data-v="spread"]');
  await p.check("#crop");
  const book = await cropped();
  const halves = await p.$$eval("#stage svg.pdf-crop", els => els.map(e => ({ w: +e.getAttribute("width"), x: +e.getAttribute("viewBox").split(" ")[0] })));
  check("book pages with mirrored margins each crop around their own text", book && near(book[0], 2.74, 0.08) && halves.length >= 2 && near(halves[0].w, halves[1].w, 0.01) && halves[0].x > halves[1].x + 20, `${await status()} ${JSON.stringify(halves.slice(0, 2))}`);
  await p.click('#spreadAll button[data-v="single"]');
  await p.uncheck("#crop");

  // Calibration: the card opens at bank-card size and + makes it bigger (left open for the checks below)
  await p.click("#cal-btn");
  const calW = () => p.$eval("#cal-card", e => e.getBoundingClientRect().width);
  const w0 = await calW();
  await p.click("#cal-plus");
  const w1 = await calW();
  check("calibration card shows and + makes it bigger", await p.isVisible("#cal-card") && w1 > w0 && /upright/.test(await p.textContent("#cal-card")) === phone, `${w0} → ${w1}`);

  // Reference screen: off until chosen, then a table below the cards (left on for the layout and accessibility checks)
  const refShown = () => p.$eval("#ref-panel", e => !e.hidden);
  const noRef = !(await refShown()) && (await p.locator("#cards .card.is-ref").count()) === 0;
  await p.locator('#cards [data-act="ref"][data-i="0"]').click();
  const rows = await p.locator("#ref-panel tbody tr").count();
  check("no reference until chosen; Set as reference shows the comparison table", noRef && await refShown() && rows === await cardCount(p) && (await p.locator("#cards .card.is-ref").count()) === 1, `${noRef}, ${rows} rows`);
  check("the reference table offers all five comparison tabs", await p.getByRole("tablist", { name: "Reference comparison modes" }).getByRole("tab").count() === 5);

  if (phone) {
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check("no sideways scrolling on a phone", overflow <= 0, overflow + " px too wide");
    check("quick controls bar is visible", await p.isVisible("#quickbar"));
  }

  // Accessibility scan (only when axe-core is installed)
  if (axeSource) {
    await p.addScriptTag({ content: axeSource });
    const bad = await p.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations.map(v => `${v.id} (${v.nodes.length})`));
    check("no accessibility problems (axe-core)", bad.length === 0, bad.join(", "));
  } else console.log("  - accessibility scan skipped (run npm install in tests/ to add axe-core)");

  // Methodology page: a footer link opens it, it reads well on a phone, and it links back
  const methLink = p.locator('.site-foot a[href="methodology.html"]');
  check("the footer has a Methodology link", (await methLink.count()) === 1 && (await methLink.textContent()) === "Methodology");
  const cardsBefore = await cardCount(p);
  await methLink.click();
  await p.waitForSelector("h1");
  const meth = await p.evaluate(() => ({ h1: document.querySelector("h1").textContent, sections: [...document.querySelectorAll("main section h2")].map(h => h.textContent), over: document.documentElement.scrollWidth - innerWidth, font: parseFloat(getComputedStyle(document.body).fontSize), bg: getComputedStyle(document.body).backgroundColor }));
  check("the methodology page opens with all ten topics, no sideways scrolling, 16 px text", meth.h1 === "How True Size Screens works" && meth.sections.length === 10 && meth.over <= 0 && meth.font >= 16, JSON.stringify(meth));
  if (axeSource) {
    await p.addScriptTag({ content: axeSource });
    const bad = await p.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations.map(v => `${v.id} (${v.nodes.length})`));
    check("methodology page: no accessibility problems (axe-core)", bad.length === 0, bad.join(", "));
  }
  await p.click('.back a');
  await p.waitForSelector("#cards .card");
  check("its back link returns to the comparison, as it was", await refShown() && (await cardCount(p)) === cardsBefore, `${p.url()} ${await refShown()} ${await cardCount(p)} cards`);

  // Offline: after one visit, the site opens with no connection
  const hasSw = await p.evaluate(() => [...document.scripts].some(s => s.textContent.includes("serviceWorker")));
  if (hasSw) {
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    await ctx.setOffline(true);
    await p.reload();
    const offOk = await p.waitForSelector("#results .res", { timeout: 8000 }).then(() => true, () => false);
    check("opens offline after the first visit", offOk);
    await p.setInputFiles("#pdf-file", { name: "offline.pdf", mimeType: "application/pdf", buffer: tinyPdf() });
    const offPdf = await p.waitForFunction(() => /^offline: .*5\.00 × 7\.00 in/.test(document.querySelector("#pdf-status").textContent), null, { timeout: 15000 }).then(() => true, () => false);
    check("PDFs open offline after one was opened online", offPdf, await p.textContent("#pdf-status"));
    const offMeth = await p.goto(base + "methodology.html").then(r => r && r.ok(), () => false);
    check("the methodology page opens offline too", offMeth && (await p.textContent("h1")) === "How True Size Screens works");
    await ctx.setOffline(false);
  }

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// The pdf.js version must be the same in index.html, sw.js and the pdfjs/ folder name,
// and the library and its worker must be the same version
function pdfjsVersions() {
  section("PDF reader files");
  const page = /pdfjs\/([\d.]+)\//.exec(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"));
  const sw = /PDFJS_VERSION = "([\d.]+)"/.exec(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"));
  const v = page && page[1], dir = path.join(ROOT, "pdfjs", v || "-");
  const inFile = f => { try { return (/pdfjsVersion = ([\d.]+)/.exec(fs.readFileSync(path.join(dir, f), "utf8")) || [])[1]; } catch (e) { return null; } };
  check("index.html and sw.js name the same pdf.js version", v && sw && v === sw[1], `${v} vs ${sw && sw[1]}`);
  check("pdf.min.mjs and pdf.worker.min.mjs are that version", inFile("pdf.min.mjs") === v && inFile("pdf.worker.min.mjs") === v);
  const wasm = ["jbig2.wasm", "openjpeg.wasm", "qcms_bg.wasm", "jbig2_nowasm_fallback.js", "openjpeg_nowasm_fallback.js"];
  check("image decoders for scanned PDFs are included (wasm/)", wasm.every(f => fs.existsSync(path.join(dir, "wasm", f))));
  const others = fs.readdirSync(path.join(ROOT, "pdfjs")).filter(f => f !== v);
  check("no leftover files from another pdf.js version", others.length === 0, others.join(", "));
}

(async () => {
  pdfjsVersions();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    await run(browser, base, "Desktop (1280 × 800)", { viewport: { width: 1280, height: 800 } });
    await run(browser, base, "iPhone 13", { ...devices["iPhone 13"] });
  } catch (e) {
    check("test crashed", false, e.message);
  }
  await browser.close();
  server.close();
  finish();
})();
