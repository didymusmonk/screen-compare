# Tests

These files check that True Size Screens works and that its numbers are right. They aren't part of the site.

| File | What it checks | Needs a browser? | Time |
|---|---|---|---|
| `unit.js` | The math and the data, against values worked out by hand: screen size, PPI, area and megapixels; rotation; video bars, picture diagonal and area; e-book line and word counts; page fit; margin cropping; website scaling; `devices.csv`; the offline rules in `sw.js` | No | 2 s |
| `smoke.js` | Every feature works at all, on a desktop and an iPhone 13: devices, search, modes, share link, PDF and crop, phone layout, the methodology page, accessibility (axe-core), offline | Yes | 10 s |
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

Or one file at a time: `node tests/unit.js`, `node tests/smoke.js`, `node tests/browser.js`. Only failed checks are printed (✗ with the section and a short reason), and each file ends with one line saying how many passed and failed. The exit code is 0 only when everything passed.

### Which test to run while you work

Run the narrowest test that covers your change while you work, then `node tests/run-all.js` once before opening a pull request. GitHub runs the full suite on every pull request anyway.

| You changed | Run | Time |
|---|---|---|
| `devices.csv`, a calculation, `sw.js` rules | `node tests/unit.js` | 2 s |
| Layout, controls, phone view, accessibility, `methodology.html` | `node tests/smoke.js` | 10 s |
| One area of what visitors see | `ONLY=<steps> node tests/browser.js` | 1–3 s per step; `pdfs` about 30 s |
| Wording only | proofread in context; nothing extra locally | |

The `browser.js` steps are `geometry`, `customForm`, `myScreenMatching`, `pages`, `pdfs`, `video`, `ebook`, `website`, `persistence`, `reference`, `calibration`, `malformed`, `devicesById`, `failures` and `serviceWorkerUpdate`. Use the exact step names, separated by commas: `ONLY=pdfs,video node tests/browser.js`.

The browser tests start their own local web server and block the analytics script, so test runs aren't counted as visits.

## On GitHub

`.github/workflows/tests.yml` runs `run-all.js` on every push to `main` and every pull request. The result shows as a tick or cross next to the commit, under the **Actions** tab. It doesn't change or delay the live site.

## Adding a test

- A new calculation: add a check to `unit.js` with a hand-worked expected value (not the app's own formula).
- A new feature or a bug fix: add a check to `browser.js` that fails without the fix.
- Keep `smoke.js` quick: one check that the feature works at all.

## WebKit (the engine inside Safari)

Playwright's own WebKit can't be downloaded in every environment, so `webkit.js` uses WebKitGTK's MiniBrowser instead. On Ubuntu or Debian:

```
sudo apt install webkit2gtk-driver xvfb
xvfb-run -a node tests/webkit.js
```

It runs `browser-check.html` at desktop and phone width and with WebAssembly removed from pdf.js (like iOS Lockdown Mode), then checks offline use. WebKitGTK shares Safari's engine but not Apple's graphics or iOS, so a pass is strong evidence, not proof.

## On a real iPhone or iPad

Open `https://didymusmonk.github.io/screen-compare/tests/browser-check.html`, tap **Run the check** and keep the page scrolled to the top until it finishes (about a minute). Add `?nowasm` to the address to test without WebAssembly. It downloads sample PDFs from Mozilla's pdf.js project on GitHub.

## What still needs a real device

Automated tests run in desktop Chromium, including iPhone emulation, which isn't real Safari. Check these by hand on an iPhone (Safari) after big changes:

- the drawing at **Actual size** against a ruler or a bank card, after calibrating
- touch: dragging and rotating screens in Free arrange, reordering cards, pinch zoom
- "Compare with my screen" (it reads the real screen)
- opening a large real PDF, and Add to Home Screen plus offline use in Safari
- the serif font's look in e-book mode (Safari uses its own Georgia)
