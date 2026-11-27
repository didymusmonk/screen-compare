// Browser test helpers: a tiny local web server for the repo, and PDFs built by hand (no sample files needed).
const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".csv": "text/csv", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

// Serves the repo folder. `override(pathname)` can return { status, body, type } to replace a file for a test
// (for example a newer sw.js, or a missing devices.csv), or { delay } to send the real file late.
function serve(root, override = () => null) {
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    let o = override(p);
    if (o && o.delay) { await new Promise(r => setTimeout(r, o.delay)); o = null; } // { delay: ms }: send the real file late
    if (o) { res.writeHead(o.status || 200, { "Content-Type": o.type || TYPES[path.extname(p)] || "text/plain", "Cache-Control": "no-cache" }); return res.end(o.body || ""); }
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

// A PDF from a list of pages: { w, h } in points (72 per inch) plus optional drawing commands.
function makePdf(pages) {
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", ""];
  const kids = [];
  for (const pg of pages) {
    const draw = pg.draw || "";
    const page = objs.length + 1, stream = page + 1;
    kids.push(`${page} 0 R`);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pg.w} ${pg.h}] /Contents ${stream} 0 R >>`);
    objs.push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  let out = "%PDF-1.4\n";
  const offs = objs.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

module.exports = { serve, makePdf };
