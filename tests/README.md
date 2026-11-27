# Tests

These files check that True Size Screens works and that its numbers are right. They aren't part of the site.

| File | What it checks | Needs a browser? | Time |
|---|---|---|---|
| `unit.js` | The math and the data, against values worked out by hand: screen size, PPI and area; rotation; video bars; e-book line and word counts; page fit; margin cropping; website scaling; `devices.csv`; the offline rules in `sw.js` | No | 2 s |
| `smoke.js` | Every feature works at all, on a desktop and an iPhone 13: devices, search, modes, share link, PDF and crop, phone layout, accessibility (axe-core), offline | Yes | 10 s |
| `browser.js` | What visitors see: card numbers and the drawing for hand-checked screens, zoom and calibration, your own screen form, page and PDF fit, quick page turns and PDF swaps, video, e-book, website, saving, share links (including old ones), broken saved settings, a missing device list, an offline update | Yes | 1–2 min |
| `run-all.js` | Runs all three and prints a summary | | |

`lib/` holds shared helpers. `lib/app.js` copies functions out of `index.html` so `unit.js` can test them without a browser, without changing the app.

Most checks use made-up screens with easy numbers. "Test 13" is 13 inches with 1200 × 500 pixels: the 5-12-13 triangle, so it's exactly 12 × 5 inches at 100 pixels per inch, and the expected values can be checked on paper.

## Running them

You need [Node.js](https://nodejs.org) 18 or newer. The first time, from the repo folder:

```
cd tests
npm install
npx playwright install chromium
cd ..
```

Then, after any change:

```
node tests/run-all.js
```

Or one file at a time: `node tests/unit.js`, `node tests/smoke.js`, `node tests/browser.js`. Each check prints ✓ or ✗ with a short reason, and each file ends with how many passed. The exit code is 0 only when everything passed. To run part of `browser.js`, name the steps: `ONLY=pdfs,video node tests/browser.js`.

The browser tests start their own local web server and block the analytics script, so test runs aren't counted as visits.

## On GitHub

`.github/workflows/tests.yml` runs `run-all.js` on every push to `main` and every pull request. The result shows as a tick or cross next to the commit, under the **Actions** tab. It doesn't change or delay the live site.

## Adding a test

- A new calculation: add a check to `unit.js` with a hand-worked expected value (not the app's own formula).
- A new feature or a bug fix: add a check to `browser.js` that fails without the fix.
- Keep `smoke.js` quick: one check that the feature works at all.

## What still needs a real device

Automated tests run in desktop Chromium, including iPhone emulation, which isn't real Safari. Check these by hand on an iPhone (Safari) after big changes:

- the drawing at **Actual size** against a ruler or a bank card, after calibrating
- touch: dragging and rotating screens in Free arrange, reordering cards, pinch zoom
- "Compare with my screen" (it reads the real screen)
- opening a large real PDF, and Add to Home Screen plus offline use in Safari
- the serif font's look in e-book mode (Safari uses its own Georgia)
