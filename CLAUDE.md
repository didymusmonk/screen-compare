# True Size Screens: project notes

## Purpose

A free web tool that compares phone, tablet, e-reader, tablet PC (Surface Pro and similar), laptop and monitor screens at true relative size. It also shows what you'd see on each screen: pixel density (PPI), physical size, and how a page, PDF, video, e-book or website fits.

- Live: https://didymusmonk.github.io/screen-compare/ (GitHub Pages, `main` branch, root folder)
- Owner: DidymusMonk, a first-time app builder. Explain changes in plain, beginner-friendly terms.
- Inspired by what comparisontabl.es does, but it must never copy that site's look, wording or code.
- Analytics (GoatCounter, Nov 2026): about 79% of visitors are on phones and 95% use Safari. Test phone layouts and iOS Safari first.

## Architecture

The site is static, with no build step, no framework, no backend and no npm dependencies at runtime.

| File | What it is |
|---|---|
| `index.html` | The whole app: HTML, CSS and JS in one file (about 1,500 lines) |
| `devices.csv` | Built-in screens and paper sizes, loaded with `fetch()` at startup |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | "Add to Home Screen" support |
| `sw.js` | Service worker for offline use. The page and `devices.csv` load fresh when online (revalidated every time, 3-second limit, then the saved copy). Icons and manifest are saved on install (cache `tss-core-<VERSION>`). The PDF reader is saved in its own cache, `tss-pdfjs-<PDFJS_VERSION>`, the first time a PDF is opened, decoders included. Each new version deletes older `tss-` caches. Registered only in the GitHub copy, by `wrap.sh` |
| `favicon.svg`, `og-image.png` | Tab icon and link-preview image |
| `pdfjs/6.5.438/` | pdf.js 6.5.438, the **legacy** build (`pdf.min.mjs`, `pdf.worker.min.mjs`, Apache-2.0 `LICENSE`) plus `wasm/` (JBIG2, JPEG 2000 and color-profile decoders, their no-wasm JavaScript fallbacks and licenses), copied unchanged from the `pdfjs-dist` npm package. The folder is named after the version |
| `tests/` | Not part of the site. `unit.js`: math and data checked in Node against hand-worked values (geometry, video, e-book, page fit, crop detection, website scaling, `devices.csv`, `sw.js` rules); `lib/app.js` copies named functions out of `index.html` for it. `smoke.js`: every feature works, desktop + iPhone 13, axe-core, offline. `browser.js`: card numbers and drawing for hand-checked custom screens, zoom/calibration, custom form validation, PDF fit, quick page turns and PDF swaps, saving, share links (incl. a frozen old link), broken saved settings, missing device list, service worker update. `run-all.js` runs all three. `browser-check.html` + `webkit.js`: in-page PDF check (pdf.js sample PDFs, crop, page turns, fits, two-page view, optional `?nowasm`) that also runs on real iPhones via the live site, and a WebKitGTK runner for it (`xvfb-run -a node tests/webkit.js`, needs `webkit2gtk-driver`). Setup in `tests/README.md` |
| `.github/workflows/tests.yml` | Runs `node tests/run-all.js` on pushes to `main` and on pull requests |
| `.gitattributes` | Marks `pdfjs/` as third-party (`linguist-vendored`) so GitHub's language bar counts only our own code. No effect on the site |
| `README.md`, `LICENSE` | Public description and the MIT license (© 2026 DidymusMonk) |

Inside `index.html`, all state lives in one object, `S`, and is saved to `localStorage` under the `tss:` prefix. Every change calls `save()` and then `renderAll()`, which redraws the category list, search results, the SVG stage and the cards. Main functions:

- `parseCsv` / `loadDevices`: read `devices.csv`. The `RENAMED` map keeps old saved IDs working after a device is renamed.
- `geom(dev, flip)`: physical width and height in inches, from the diagonal and the pixel aspect ratio.
- `renderStage`: draws the SVG stage in three modes: side by side, overlay, or free arrange (drag, snapping guides, rotation, keyboard moves).
- `drawPage` / `drawVideo` / `drawEbook` / `drawSite`: draw the content previews. `lorem()` supplies the lorem ipsum text for page previews.
- `ebookText` / `layoutEbook` / `ebookFit`: the e-book mode. `AUSTEN` holds the sample passage (Pride and Prejudice, ch. 42 to the start of ch. 43). `ebookText()` measures each word once with canvas `measureText()` (in ems), and `layoutEbook()` wraps it into lines and columns. The preview draws exactly those lines, and the card's words, lines and characters per line come from the same layout, so they always agree and don't change with zoom.
- `dprOf(dev)`: estimates each device's display scaling (CSS pixels) for the website previews.
- `renderCards`: the info card for each selected screen.
- `shareUrl` / `fromShare`: share links in the form `#s=<base64url JSON>`. Saved settings and share links are sanitized after loading (`isObj`, `okScreen`): a malformed screen list, positions, custom screens, e-book size or calibration is dropped, not trusted.
- `ppiCal` / `drawCal` / `setCal` / `scaleNote`: calibration. `ppiCal` is CSS pixels per real inch on this screen, saved alone as `tss:ppiCal` (a plain number, 50 to 260, `okCal`), plus `tss:ppiCalDpr`, the `devicePixelRatio` when it was set. It only sets the drawing scale in "Actual size" (`S.scale`), never a card number. `scaleNote()` says whether it's the default 96, calibrated, or out of date (browser zoom or display changed), and in Fit or manual zoom gives the percentage of actual size. `S.zoom` and `S.scale` are validated on load too (`ZOOM_MIN`/`ZOOM_MAX`, which cover the calibration range).
- `myScreenMatches` / `setupMyPhone`: the "Compare with my screen" feature.
- `loadPdfjs` / `openPdf`: the PDF preview. `PDFJS` holds the versioned folder. `pdf.min.mjs` loads with `import()` only when a PDF is opened, and the parsing runs in a background module Web Worker (`pdf.worker.min.mjs`). `getDocument()` gets `wasmUrl` so scans (JBIG2) and JPEG 2000 images decode. Opening a new PDF destroys the previous one's loading task (and its worker).
- `inkBox` / `pageInk` / `scanDoc` / `prepareCrop` / `cropOf`: the "Crop white margins" checkbox (`S.crop`). `pageInk()` renders a page at 800 px, finds the content box and caches it per page in `pdf.ink`. `scanDoc()` samples up to 12 pages for a typical crop size and odd/even position. `prepareCrop()` sets `pdf.crops` for the two pages on screen, and `paperDims()` then returns the cropped page.

## Key decisions and why

- **One file, no build.** The owner is new to coding and can edit it on GitHub directly. It also loads fast, at about 37 KB compressed per visit.
- **Devices live in a CSV, not in the code.** This lets non-programmers add or fix a device on GitHub (the README explains how).
- **Outlines show the screen area only, never the bezels.** The size comes from the diagonal and the pixel aspect ratio, because those are what spec sheets publish reliably.
- **PDFs never leave the browser.** pdf.js renders them locally. It loads on demand because most visitors never open a PDF, and it is the biggest download (about 155 KB plus a 395 KB worker, compressed, and up to 150 KB of decoders). It is hosted in the repo, not on a CDN, so the site depends on no outside service.
- **pdf.js uses the legacy build** (Nov 2026, 6.5.438). The modern build officially supports only the latest Chrome and Firefox and calls newer JavaScript (such as `Map.getOrInsertComputed`) that iOS Safari lacks. The legacy build adds most of those and lists Safari 18+. It does not polyfill `Promise.withResolvers` or `ArrayBuffer.prototype.transferToFixedLength` (pdf.js issue 22279, closed as not planned), so it fails on Safari 16.4–17.3, and it can't even be parsed before Safari 16.4 (static class blocks). `index.html` adds `Response.prototype.bytes`, which only matters on Safari 17.4–17.x. `isEvalSupported` was removed in pdf.js 5.7: since then pdf.js never turns PDF content into code. See the Safari audit (Nov 2026): https://claude.ai/artifact/C8pkfzDjYNn6n9H49pJjR2
- **The pdf.js folder is named after its version** so that a page can never load a worker or decoders from another version, saved or not. The service worker caches it cache-first under that versioned path, and `PDFJS_VERSION` in `sw.js` names the cache.
- **Crop white margins is one checkbox, off by default, with no manual controls** (Thomas, Nov 2026). The background is the most common color (so off-white scans work), anything 40+ levels away is ink, groups under 3 cells (4 px each) are dust, and ink in the outer 1.5% band counts only if it joins content further in. 0.12 in safety margin. Every page gets the same cropped size (the largest content of the sample, skipping one outlier such as a cover), placed per odd/even page so mirrored book margins crop well, and grown for any page with more content. A page with no clear background (a photo) isn't cropped. The cropped page replaces the page in Fit page, Fit width and the card stats; 100% keeps printed scale.
- **Calibration uses a bank card, ID-1, exactly 85.60 × 53.98 mm** (`CARD_MM`, Nov 2026). Below `CAL_UPRIGHT` (the card's long side at 165 px per inch, about 556 px) the card is drawn upright, because lying sideways it is wider than any phone; the card's box spans the panel's full width so it fits an iPhone. − and + buttons move it in 0.5 px-per-inch steps (about 0.3%) for fingers. Pressing Done confirms the current value. Calibration is kept by "Reset to start" and isn't in share links, since it belongs to the visitor's screen.
- **The website previews are generic and unbranded** (news, search, social, shop, wiki) to avoid trademark trouble and to stay original.
- **The default first visit shows only two screens:** iPad mini (A20 Pro) and iPad Pro 11" (M5), both portrait, with a Letter page fit. A short page suits phone visitors.
- **Lorem text is drawn as real SVG `<text>`, ragged right.** `textLength` justification made redraws about 10× slower. `PROSE_EM` measures the browser's real serif width so that lines wrap correctly. Below 3.5 px, the text turns into gray bars (in e-book mode, bars the length of the real lines).
- **E-book auto columns aim for 45–75 characters per line.** Auto lays the text out in one and two columns and picks the one whose real line length is closer to that range, so it reacts to font size and screen width. The passage repeats from the start if a huge screen at a tiny size runs out. The letter heights on the cards use the font's real cap height and x-height where the browser reports them (0.7 and 0.47 em otherwise).
- **Device audit (Nov 2026).** All 315 rows were checked (Gemini research, script checks, Claude reviewed exceptions); no figures changed, 58 devices were added, 6 grouped names gained models (with `RENAMED` entries) and Surface Duo moved to Phones. Records and tools (`validate_db.py` checks any list) are on the `device-database-audit` branch, folder `device-audit/`. Lesson: AI researchers call real recent products "rumored"; check the maker's newsroom before believing them.
- **Unreleased devices are left out** (for example, the iPad 12th gen as of Nov 2026).
- **The device list is sorted** by category (Tablets, Phones, E-readers, Tablet PCs, Laptops, Monitors, Paper), then by brand (Apple, Samsung, Microsoft, Lenovo, Google, then others, then generic), with product families kept together and the newest models first.

## Conventions

- To upgrade pdf.js, follow the README's steps: new `pdfjs/<version>/` folder from the `pdfjs-dist` **legacy** build, change `PDFJS` in `index.html` and `PDFJS_VERSION` in `sw.js`, delete the old folder, run the smoke test (it checks the three agree), and republish the Artifact preview with the new files (`.mjs` as `text/javascript`, `.wasm` as `application/wasm`) and the old paths removed. The Artifact service refuses text files containing an ESC byte, and `pdf.worker.min.mjs` 6.5.438 has two inside string literals, so the preview's copy has them written as `\x1b` (same behavior, checked by rendering the sample PDFs). The repo copy stays unchanged. Read the release notes for removed or renamed `getDocument()` options.
- Plain JavaScript with small helpers: `$` for querySelector, `esc()` for HTML escaping, and the `store` wrapper for localStorage.
- Every user-facing string is plain English in sentence case. Avoid jargon, or explain it in the glossary.
- Accessibility is required. Text contrast must be at least 4.5:1 in both themes, every control must work by keyboard, and the SVG stage has an `aria-label`. Arrange mode announces changes through `#sr-live`, and focus is restored after redraws. Check changes with axe-core.
- Phone layout (≤700 px): sticky `#quickbar`, a "More options" toggle, touch targets of at least 44 px, and 16 px inputs so iOS doesn't zoom in.
- If a change to `sw.js` itself, or to an icon or the manifest, must reach visitors who already have it saved, bump `VERSION` in `sw.js`. A pdf.js upgrade changes `PDFJS_VERSION` instead. Changes to `index.html` and `devices.csv` show up without that.
- Device IDs come from `slug(name)`, where "+" becomes "plus" (Nov 2026: "Galaxy S26+" and "Galaxy S26" used to share an ID, so one couldn't be picked). Two names must never make the same ID; `unit.js` checks it. When a rename changes an ID, add the old one to `RENAMED`.
- Device rows in the CSV are `name,type,diagonal,width,height`. Paper rows leave `diagonal` empty and give inches. Keep the README's device count in sync.
- Commit straight to `main` with a short, plain-English message.

## How the files are produced (owner's Claude workflow)

The working copies sit outside the repo, in a Claude project folder (`/mnt/project-files/screen-compare/`):

- `index.html` there is the **Artifact preview source**. It has no `<!doctype>`/`<head>` wrapper. Preview: https://claude.ai/artifact/WhqeFfcgT7a4HBnUySpaFa (publish it with `devices.csv` as an extra file).
- `wrap.sh` builds the repo's `index.html` from that source. It adds the doctype, meta description, Open Graph and Twitter tags, favicon, canonical link, manifest and Apple tags, theme color, and the service worker registration and the GoatCounter script (both in the GitHub copy only). Always rebuild with it. Don't hand-edit the two copies separately.
- Since the Nov 2026 device audit, `devices.csv` itself is the source. `gen_csv.py <in.csv> <out.csv>` only sorts it (the old `gen_csv_legacy.py` + `raw.json` are stale; never use them, they would undo the audit).
- Run `node tests/run-all.js` after every change (it serves the repo itself). Add a quick check to `smoke.js` when a new feature ships, exact numbers to `browser.js` or `unit.js`, and a regression check for every bug fixed. `unit.js` relies on top-level declarations in the script starting at column 0 and multi-line ones ending with a line that starts with `}` or `]`. One-off Playwright scripts are still fine for deeper checks such as touch drag.

## Known issues and limits

- **Opening `index.html` straight from disk (`file://`) shows no devices**, because browsers block `fetch()` of local files there. Use a local web server.
- **"Compare with my screen" is a best guess.** It uses `screen.width × devicePixelRatio`, which display scaling and browser zoom can change. On a Mac it only matches by aspect ratio, then filters to Apple models.
- **The `dprOf()` display-scaling values are approximations**, so website previews show roughly what each device fits, not exactly.
- **Diagonals are rounded marketing figures**, and some panels have rounded corners or notches. The sizes are accurate to about 1–2%.
- **Sample text width depends on the visitor's serif font.** Because it is measured, the wrapping stays sensible, but line breaks and e-book counts differ a little between devices (Georgia on iPhone versus Times on Linux, for example).
- **The project folder adds C2PA metadata to SVG files written there**, which bloated `favicon.svg` from 316 bytes to 8 KB. Edit `favicon.svg` in the repo itself and don't copy it back from that folder.
- **The README's device count is updated by hand.**
- **A tab left open across a pdf.js upgrade can't open its first PDF** until it's reloaded, because the old version's files are deleted. It says "The PDF reader didn't load" and a reload fixes it. A PDF already open keeps working.
- **PDF previews need Safari 17.4+ (or a current Chrome, Edge or Firefox).** Tested in WebKitGTK 2.44 (Safari 17.4-era engine) and 2.52, and on a real iPad mini 5 (iPadOS 18) and iPhone (iOS 27). Safari 16.4–17.3 fail at `Promise.withResolvers`; older Safari can't load the module at all. Those visitors see the "PDF reader didn't load" message; the rest of the site works.
- **Calibration may not notice page zoom on iPhone and iPad.** Desktop Chrome, Edge and Firefox change `devicePixelRatio` with zoom, so the note asks to recalibrate; Safari may not, so after changing its page zoom (aA menu) the visitor may have to recalibrate on their own (the hint says so). Not yet checked on a real iPhone. Safari may also clear saved settings for a site not visited in 7 days, which resets the calibration; a site added to the Home Screen keeps it.
- **No CMap or standard-font files are shipped** (same as before the 6.5 upgrade): PDFs that rely on non-embedded CJK fonts may show wrong or missing text.

## Next steps (ideas, not commitments)

- Add new devices as they ship (iPad 12th gen when it's released, 2027 phones).
- A search for "devices similar in size to X".
