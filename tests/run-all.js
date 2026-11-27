// Runs every test file, one after the other, and prints a short summary at the end.
//
//   node tests/run-all.js        (from the repo folder; or "npm test" inside tests/)
//
// unit.js     math and data, no browser (a second or two)
// smoke.js    every feature works at all, desktop and iPhone (about 10 seconds)
// browser.js  the numbers on the cards and in the drawing are right, saving and sharing, offline updates (about a minute)

const { spawnSync } = require("child_process");
const path = require("path");

const files = ["unit.js", "smoke.js", "browser.js"];
const results = files.map(f => {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", env: process.env });
  process.stdout.write(r.stdout || "");
  const m = /(\d+) passed, (\d+) failed\s*$/.exec(r.stdout || "");
  return { f, ok: r.status === 0, line: m ? m[0].trim() : `didn't finish (exit code ${r.status})` };
});
console.log("\n=== Summary ===");
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.f.padEnd(11)} ${r.line}`);
process.exit(results.every(r => r.ok) ? 0 : 1);
