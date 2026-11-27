// Loads selected functions from index.html into Node, so the math can be tested without a browser.
//
// The app's script is one big block inside index.html (no build step, no modules), so this file reads that
// block and copies out the named top-level functions and constants exactly as they are written. Nothing in
// index.html needs to change for this. Top-level code in the script starts at the left edge and a multi-line
// function or list ends with a line that starts with "}" or "]", which is what the extractor relies on.
// If it ever can't find a name, the unit test fails with a clear message instead of testing the wrong thing.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const start = html.indexOf("<script>\n(() => {");
if (start < 0) throw new Error("couldn't find the app script in index.html");
const lines = html.slice(start).split("\n");

// The source of one top-level declaration: `function name(…) {…}`, `const name = …` or `let name = …`.
function source(name) {
  const re = new RegExp(`^(?:async )?function ${name}\\(|^(?:const|let) ${name} = |^(?:const|let) [\\w, =.]*\\b${name} = `);
  const i = lines.findIndex(l => re.test(l));
  if (i < 0) throw new Error(`index.html has no top-level "${name}" (was it renamed?)`);
  const first = lines[i];
  if (!first.startsWith("function") && !first.startsWith("async") && /;\s*(\/\/.*)?$/.test(first) && !/[[{(]\s*(\/\/.*)?$/.test(first)) return first;
  let j = i + 1;
  while (j < lines.length && !/^[\]})]/.test(lines[j])) j++;
  return lines.slice(i, j + 1).join("\n");
}

// Builds a sandbox holding the requested declarations plus anything the caller passes in (such as a fake S).
// `extra` is code evaluated after them, which can replace browser-only pieces (the canvas text measuring).
function load(names, globals = {}, extra = "") {
  const ctx = vm.createContext({ Math, Map, Set, JSON, Number, String, Array, Object, Uint8Array, console, ...globals });
  const code = [...new Set(names.map(source))].join("\n") + "\n" + extra + "\n;({" + names.concat(extraNames(extra)).map(n => n).join(", ") + "})";
  return vm.runInContext(code, ctx, { filename: "index.html (extracted)" });
}
const extraNames = code => [...code.matchAll(/^(?:function (\w+)\(|(?:const|let) (\w+) =)/gm)].map(m => m[1] || m[2]);

module.exports = { source, load, ROOT, html };
