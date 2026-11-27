// WebKit check for the PDF preview, using WebKitGTK's MiniBrowser through WebKitWebDriver.
// WebKitGTK shares Safari's engine (WebKit, JavaScriptCore) but not Apple's graphics, fonts or iOS
// integration, so a pass here is strong evidence, not proof, that Safari works. Real iPhones and iPads
// can run the same checks by opening tests/browser-check.html on the live site.
//
// Setup on Ubuntu/Debian (once):  sudo apt install webkit2gtk-driver xvfb
// Run (from the repo folder):     xvfb-run -a node tests/webkit.js
//
// It runs tests/browser-check.html three ways (desktop size, phone size, WebAssembly removed),
// then checks the site and PDFs offline. Exit code 0 means every check passed.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".csv": "text/csv", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const BROWSER = process.env.MINIBROWSER || "/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser";
const PORT = 4444;
let failed = 0, passed = 0;
const check = (name, ok, detail = "") => { ok ? passed++ : failed++; console.log((ok ? "  ✓ " : "  ✗ ") + name + (detail ? "  (" + detail + ")" : "")); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function serve(port = 0) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, "127.0.0.1", () => r(server)));
}

// --- a minimal W3C WebDriver client ---
async function wd(method, p, body) {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (j.value && j.value.error) throw new Error(j.value.error + ": " + j.value.message); return j.value;
}
async function browser(env = {}) {
  const driver = spawn("WebKitWebDriver", ["--port=" + PORT], { env: { ...process.env, ...env }, stdio: "ignore" });
  for (let i = 0; i < 100; i++) { try { await fetch(`http://127.0.0.1:${PORT}/status`); break; } catch (e) { await sleep(100); } }
  const v = await wd("POST", "/session", { capabilities: { alwaysMatch: { "webkitgtk:browserOptions": { binary: BROWSER, args: ["--automation"] } } } });
  const s = p => `/session/${v.sessionId}${p}`;
  return {
    version: v.capabilities.browserVersion,
    go: url => wd("POST", s("/url"), { url }),
    exec: (script, ...args) => wd("POST", s("/execute/sync"), { script, args }),
    size: (width, height) => wd("POST", s("/window/rect"), { width, height }),
    refresh: () => wd("POST", s("/refresh"), {}),
    async quit() { try { await wd("DELETE", s("")); } catch (e) {} driver.kill(); await sleep(300); },
  };
}
async function waitFor(b, script, ms = 60000) {
  const t = Date.now();
  while (Date.now() - t < ms) { try { const v = await b.exec(script); if (v) return v; } catch (e) {} await sleep(250); }
  return null;
}
async function runCheckPage(label, base, env, size, query = "", seed = false) {
  console.log(`\n${label}`);
  const b = await browser(env);
  try {
    if (size) await b.size(size[0], size[1]);
    // a returning visitor: only paper sizes shown, plus a made-up setting. The check must run from the
    // defaults anyway and give these back untouched afterwards.
    const mine = { "tss:state": JSON.stringify({ cat: "paper", sel: [] }), "tss:ppiCal": "123" };
    if (seed) { await b.go(base + "tests/"); await b.exec("localStorage.clear(); for (const [k, v] of Object.entries(arguments[0])) localStorage.setItem(k, v); return true", mine); }
    await b.go(base + "tests/browser-check.html?auto" + query);
    const res = await waitFor(b, "return window.__check && window.__check.done ? window.__check : null", 300000);
    if (!res) { check("check page finished", false, "timed out"); return; }
    for (const r of res.results) {
      if (r.kind === "info") console.log("  - " + r.text);
      else check(r.text, r.kind === "ok", r.detail);
    }
    if (seed) {
      const after = await b.exec("const o = {}; for (const k of Object.keys(localStorage)) o[k] = localStorage.getItem(k); return o");
      check("the visitor's own saved settings are back afterwards", JSON.stringify(after) === JSON.stringify(mine), JSON.stringify(after).slice(0, 120));
    }
    return res;
  } finally { await b.quit(); }
}

(async () => {
  let server = await serve();
  const port = server.address().port, base = `http://127.0.0.1:${port}/`;
  try {
    const first = await runCheckPage("WebKit, desktop size (as a returning visitor with saved settings)", base, {}, null, "", true);
    if (first) console.log("  - engine: WebKitGTK " + (first.env.userAgent.match(/AppleWebKit\/[\d.]+/) || [""])[0]);
    await runCheckPage("WebKit, phone size (390 px wide)", base, {}, [390, 844]);
    // WebKitGTK can't turn WebAssembly off from outside, so the check page removes it from pdf.js's worker
    await runCheckPage("WebKit without WebAssembly (simulated, like iOS Lockdown Mode)", base, {}, null, "&nowasm");

    console.log("\nWebKit offline");
    const b = await browser();
    try {
      await b.go(base);
      await waitFor(b, "return document.querySelectorAll('#results .res').length > 200");
      await b.exec("navigator.serviceWorker.ready.then(() => window.__swReady = true); return true");
      await waitFor(b, "return !!window.__swReady", 30000);
      await b.refresh();
      await waitFor(b, "return document.querySelectorAll('#results .res').length > 200");
      check("the site installs its offline support", !!(await waitFor(b, "return !!navigator.serviceWorker.controller", 10000)));
      // open a PDF while online, so the reader is saved
      const openJs = name => `
        const w = window, bytes = window.__pdf;
        const dt = new DataTransfer(); dt.items.add(new File([bytes], "${name}.pdf", { type: "application/pdf" }));
        const i = document.querySelector("#pdf-file"); i.files = dt.files; i.dispatchEvent(new Event("change", { bubbles: true })); return true;`;
      await b.exec(`fetch("https://raw.githubusercontent.com/mozilla/pdf.js/v6.5.438/test/pdfs/perf_codecs_jbig2.pdf").then(r => r.arrayBuffer()).then(a => window.__pdf = new Uint8Array(a)); return true;`);
      await waitFor(b, "return !!window.__pdf");
      await b.exec(openJs("online"));
      const on = await waitFor(b, "return /^online:/.test(document.querySelector('#pdf-status').textContent)");
      check("a scanned PDF opens online", !!on);
      const saved = await waitFor(b, "return caches.keys().then(k => k.includes('tss-pdfjs-6.5.438') ? caches.open('tss-pdfjs-6.5.438').then(c => c.keys()).then(r => r.length >= 5) : false)", 20000);
      check("the whole PDF reader is saved for offline use", !!saved);
      // take the site's server away: every request to it now fails, like having no signal
      await new Promise(r => server.close(r)); server.closeAllConnections && server.closeAllConnections();
      await b.refresh();
      const offPage = await waitFor(b, "return document.querySelectorAll('#results .res').length > 200", 30000);
      check("the site opens with its server unreachable", !!offPage);
      await b.exec(`fetch("https://raw.githubusercontent.com/mozilla/pdf.js/v6.5.438/test/pdfs/perf_codecs_jbig2.pdf").then(r => r.arrayBuffer()).then(a => window.__pdf = new Uint8Array(a)); return true;`);
      await waitFor(b, "return !!window.__pdf");
      await b.exec(openJs("offline"));
      const off = await waitFor(b, "return /^offline:/.test(document.querySelector('#pdf-status').textContent) || /Couldn't|didn't load/.test(document.querySelector('#pdf-status').textContent) ? document.querySelector('#pdf-status').textContent : null", 40000);
      check("a scanned PDF opens offline", !!off && /^offline:/.test(off), off || "timed out");
    } finally { await b.quit(); server = await serve(port); }
  } catch (e) {
    failed++; console.log("\n✗ test crashed: " + e.message);
  }
  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
