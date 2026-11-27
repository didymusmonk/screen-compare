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

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".csv": "text/csv", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
let axeSource = null;
try { axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"); } catch (e) { /* axe-core not installed: accessibility check is skipped */ }

// --- tiny helpers -----------------------------------------------------------
let failed = 0, passed = 0;
function check(name, ok, detail = "") {
  if (ok) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (detail ? "  (" + detail + ")" : "")); }
}
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
const cardCount = p => p.locator("#cards .card").count();
const shapeCount = p => p.locator("#stage svg *").count();

// --- the checks -------------------------------------------------------------
async function run(browser, base, label, ctxOptions) {
  console.log(`\n${label}`);
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
  await p.locator("[data-share]").filter({ visible: true }).first().click();
  const link = await p.evaluate(() => navigator.clipboard.readText());
  const ctx2 = await browser.newContext(ctxOptions);
  await ctx2.route(url => !url.href.startsWith(base), r => r.abort());
  const p2 = await ctx2.newPage();
  await p2.goto(link);
  await p2.waitForSelector("#cards .card");
  const got = await names(p2);
  check("share link opens the same screens", link.includes("#s=") && got === want, `${want} vs ${got}`);
  await ctx2.close();

  // PDF preview (loads pdf.js from pdfjs/ on demand)
  await p.click(`${content} button[data-v="page"]`);
  await p.setInputFiles("#pdf-file", { name: "test.pdf", mimeType: "application/pdf", buffer: tinyPdf() });
  const pdfOk = await p.waitForFunction(() => /5\.00 × 7\.00 in/.test(document.querySelector("#pdf-status").textContent), null, { timeout: 15000 }).then(() => true, () => false);
  check("PDF opens and reports its page size", pdfOk, await p.textContent("#pdf-status"));

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

  // Offline: after one visit, the site opens with no connection
  const hasSw = await p.evaluate(() => [...document.scripts].some(s => s.textContent.includes("serviceWorker")));
  if (hasSw) {
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    await ctx.setOffline(true);
    await p.reload();
    const offOk = await p.waitForSelector("#results .res", { timeout: 8000 }).then(() => true, () => false);
    check("opens offline after the first visit", offOk);
    await ctx.setOffline(false);
  }

  check("no JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    await run(browser, base, "Desktop (1280 × 800)", { viewport: { width: 1280, height: 800 } });
    await run(browser, base, "iPhone 13", { ...devices["iPhone 13"] });
  } catch (e) {
    failed++; console.log("\n✗ test crashed: " + e.message);
  }
  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
