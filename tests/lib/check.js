// Tiny shared helpers for the test files: a pass/fail counter and number comparisons with a tolerance.
let failed = 0, passed = 0;
let currentSection = "";
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    return;
  }
  failed++;
  const label = currentSection ? currentSection + " / " + name : name;
  console.log("  ✗ " + label + (detail !== "" ? "  (" + detail + ")" : ""));
}
function section(title) {
  currentSection = title;
}
// true when a and b differ by at most tol (absolute)
const near = (a, b, tol = 1e-9) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;
// true when a and b differ by at most rel (relative to b)
const close = (a, b, rel = 1e-9) => near(a, b, Math.abs(b) * rel);
function finish() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
const counts = () => ({ passed, failed });
module.exports = { check, section, near, close, finish, counts };
