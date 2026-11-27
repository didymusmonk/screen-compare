# Architecture

How True Size Screens is built, for developers. The visitor-facing explanation of the formulas is [`methodology.html`](../methodology.html); keep the two consistent. For why it is built this way, see [`DECISIONS.md`](DECISIONS.md). For the development rules, see [`../AGENTS.md`](../AGENTS.md).

## 1. Overview

A static website hosted on GitHub Pages from the `main` branch (root folder). There is no build step, no framework, no backend and no runtime npm dependency. Everything runs in the visitor's browser.

```
Browser
 ├─ index.html ── HTML + CSS + one script (all app logic)
 │    ├─ fetch("devices.csv")        built-in screens and paper sizes
 │    ├─ localStorage  tss:*         saved settings, custom screens, calibration
 │    ├─ location.hash #s=...        share links
 │    └─ import("pdfjs/<ver>/pdf.min.mjs")   only when a PDF is opened
 │          └─ Web Worker pdf.worker.min.mjs (+ wasm/ decoders)
 ├─ sw.js (service worker) ── offline copies in CacheStorage
 └─ GoatCounter script (analytics, GitHub copy only)
```

## 2. Files

| File | What it is |
|---|---|
| `index.html` | The whole app: HTML, CSS and JS in one file (about 2,000 lines). |
| `devices.csv` | Built-in screens and paper sizes, loaded with `fetch()` at startup. |
| `methodology.html` | The visitor-facing "Methodology" page (footer link): formulas, how the device list was checked, calibration, content modes, privacy and limits. Standalone, with its own copy of the color tokens, no script and no analytics. Update it whenever a calculation or a privacy fact changes. |
| `sw.js` | Service worker for offline use (section 8). Registered by a small script at the end of `index.html`. |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | "Add to Home Screen" support. |
| `favicon.svg`, `og-image.png` | Tab icon and link-preview image. |
| `pdfjs/6.5.438/` | pdf.js 6.5.438, **legacy** build (`pdf.min.mjs`, `pdf.worker.min.mjs`, Apache-2.0 `LICENSE`) plus `wasm/` (JBIG2, JPEG 2000 and color-profile decoders, their no-WebAssembly JavaScript fallbacks and licenses), copied unchanged from the `pdfjs-dist` npm package. The folder is named after the version. |
| `tests/` | Not part of the site. See [`../tests/README.md`](../tests/README.md) and section 10. |
| `.github/workflows/tests.yml` | Runs `node tests/run-all.js` on pushes to `main` and on pull requests. |
| `.gitattributes` | Marks `pdfjs/` as third-party (`linguist-vendored`) for GitHub's language bar only. |
| `README.md`, `LICENSE`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `docs/` | Documentation and the MIT license (© 2026 DidymusMonk). |

`index.html` is the only source (no build step, no generated copy). The head tags above the `<title>` line (meta description, Open Graph and Twitter tags, favicon, canonical link, manifest and Apple tags, theme colors) and the two scripts before `</body>` (service worker registration and GoatCounter) are for the live site only; Claude's temporary Artifact preview leaves them out when it generates its page from this file. See `AGENTS.md` section 6 and `CLAUDE.md`.

## 3. The script inside `index.html`

The script is one IIFE, so its functions and `S` aren't reachable from the browser console or from Playwright's `page.evaluate`. Tests use the UI, or copy functions out of the file (`tests/lib/app.js`).

### State

- All state lives in one object, `S`, built from `defaults()`, then either a share link (`fromShare`) or the saved settings (`tss:state`).
- Every change calls `save()` (writes `tss:state`) and then `renderAll()`, which redraws the category list, search results, the SVG stage and the cards.
- Up to 12 screens can be selected (`MAX`). Each selection entry has an `id` (device ID), a `uid` (per-card ID) and optional per-card settings: `flip` (rotated), `spread` (two-page view), `fit`, `cols` (e-book columns).

### Main functions

| Area | Functions | Notes |
|---|---|---|
| Device list | `parseCsv`, `loadDevices`, `slug`, `catKey`, `RENAMED`, `OLD_PAPER_IDS` | Columns found by header name. Larger pixel count stored as `w`. `"tablet pc"` becomes internal category `tabletpc`. Broken rows are skipped. `RENAMED` maps old IDs to current IDs in saved selections and share links. |
| Geometry | `geom(dev, flip)` | Width, height, PPI, pixel size and area (section 5). |
| Stage | `renderStage` | SVG drawing in three modes: side by side, overlay, free arrange (drag, snapping guides, rotation, keyboard moves, announcements via `#sr-live`). |
| Content previews | `drawPage`, `drawVideo`, `drawEbook`, `drawSite`, `lorem()` | Lorem ipsum for pages, a Pride and Prejudice passage (`AUSTEN`) for e-books, generic mockups (`SITES`, `buildSite`) for websites. |
| E-book | `ebookText`, `layoutEbook`, `ebookFit` | Real text measurement and line wrapping (section 6). |
| Display scaling | `dprOf(dev)`, `siteView` | Estimated CSS-pixel scaling per device for website previews. |
| Card numbers | `statsOf(sel, dev, paper, content, ebookPt)` | Every number a card shows for the current content mode (screen size, megapixels `mp`, page fit, video incl. picture `diag` and `area`, e-book, website). Used by both `renderCards` and the reference table. Content mode and e-book text size default to the preview settings. It must never read zoom or calibration (`unit.js` checks). |
| Cards | `renderCards` | Info card per selected screen; ends by calling `renderRef`. |
| Reference comparison | `REF_COLS`, `refPct`, `fmtPct`, `renderRef` | Table `#ref-panel` below the cards (section 7). |
| Share links | `shareUrl`, `fromShare`, `SHARE_KEYS` | `#s=<base64url JSON>` (section 9). |
| Sanitizing | `isObj`, `okScreen`, `okCal` | Saved settings and share links are validated; malformed parts are dropped. |
| Calibration | `ppiCal`, `drawCal`, `setCal`, `scaleNote`, `CARD_MM`, `CAL_UPRIGHT`, `CAL_MIN`/`CAL_MAX`, `ZOOM_MIN`/`ZOOM_MAX` | Section 5.3. |
| Compare with my screen | `myScreenMatches`, `setupMyPhone` | Best guess from `screen.width × devicePixelRatio`. |
| PDF | `loadPdfjs`, `openPdf`, `PDFJS` | On-demand pdf.js (section 8.2). |
| Crop white margins | `inkBox`, `pageInk`, `scanDoc`, `prepareCrop`, `cropOf`, `paperDims`, `CROP_RES`, `CELL`, `CROP_PAD` | Section 6.3. |
| Helpers | `$`, `esc`, `store` | `querySelector`, HTML escaping, `localStorage` wrapper with the `tss:` prefix. |

## 4. Data flow

1. **Startup.** Read `tss:custom`, then a share link if the address has `#s=` (it replaces the saved layout once and the address is cleaned), else `tss:state`. Sanitize. Read calibration (`tss:ppiCal`, `tss:ppiCalDpr`).
2. **Load devices.** `fetch("devices.csv", {cache: "no-cache"})` → `parseCsv` → `BUILTIN`. Apply `RENAMED` to the selection. IDs that match nothing are dropped quietly. If the list can't load, the page shows a message; custom screens still work.
3. **Interact.** Every control updates `S`, then `save()` + `renderAll()`.
4. **Render.** For each selected screen: `geom()` → `statsOf()` → card and stage drawing. The reference table reuses the card results for Screen size and when its mode and e-book text size match the preview. Selecting another comparison tab calculates that mode only, using the same `statsOf()` function.
5. **PDF.** Choosing a file loads pdf.js (if not yet loaded), opens the file in the worker, renders the visible page(s) into each screen's preview. The file is never uploaded and is not saved; share links fall back to US Letter.

## 5. Calculation methods

### 5.1 Screen geometry (`geom`)

```
hyp   = √(width_px² + height_px²)
ppi   = hyp / diagonal_in
W     = diagonal × width_px  / hyp      (long side, inches)
H     = diagonal × height_px / hyp      (short side, inches)
area  = W × H
megapixels = width_px × height_px ÷ 1,000,000   (null for paper and aspect-ratio-only screens)
```

Portrait or landscape is the stage setting (`S.orient`), flipped per card by `flip`. Custom screens entered with an aspect ratio only (`aspectOnly`) have no PPI. Paper rows give inches directly and have no PPI; their "diagonal" is computed only for search and labels.

### 5.2 Content fits (`statsOf`)

- **Pages** (`pageFit`): scale `k` = `min(screenW/pageW, screenH/pageH)` for Fit page, `screenW/pageW` for Fit width, 1 for 100%. Cards show size vs. printed page (`k`), what 12 pt text looks like (`12 × k`), pixels per page inch (`ppi × k`), and the share of the page visible. Two-page view (`spread`) doubles the page width.
- **Video** (`videoFit`): picture width = `min(screenW, screenH × aspect)`, height = width ÷ aspect. Cards show the share of the screen used, bar sizes, the picture's diagonal and area, and its pixels.
- **E-book** (`ebookFit`): 0.3 in margin on every side, 0.5 in between columns, line height 1.5 em. Lines per column = `floor(text height / line height)`. Words, lines and characters per line come from the real layout (section 6.1). "Lines per screen" in the reference table counts every column.
- **Website** (`siteView`): CSS viewport = pixels ÷ `dprOf(dev)`. Under 600 CSS px wide shows the mobile layout, under 1024 tablet, else desktop. "Desktop site" on a narrow screen is a 980 px layout zoomed to fit. Body text size in points = `16 × zoom × dpr ÷ ppi × 72`.

### 5.3 Drawing scale and calibration

- Fit (default) scales all screens to the stage; a manual zoom slider covers `ZOOM_MIN`–`ZOOM_MAX` (6–260 CSS px per inch).
- "Actual size" draws at `ppiCal` CSS pixels per real inch: 96 by default (the CSS reference inch), or the visitor's calibrated value (50–260).
- Calibration: the visitor matches an on-screen ID-1 card (85.60 × 53.98 mm, `CARD_MM`) to a real bank card, with a slider and −/+ buttons (0.5 px-per-inch steps). Below `CAL_UPRIGHT` (about 556 px for the long side) the card is drawn upright so it fits a phone.
- `scaleNote()` says whether the scale is the default, calibrated, or out of date (the `devicePixelRatio` differs from when it was set), and in Fit or zoom gives the percentage of actual size.

### 5.4 Display scaling (`dprOf`)

Matched by name first, then by category (approximations):

| Devices | Scaling |
|---|---|
| iPhone | 3×; 2× for SE, XR, 11, 4/4s |
| iPad | 2× |
| MacBook | PPI ÷ 127 (macOS default "looks like" setting) |
| iMac, Apple Studio Display, Pro Display XDR | 2× |
| Surface RT, Laptop Go, Laptop SE | 1× |
| Surface Studio | 2× |
| Other phones | width ≈ 412 CSS px (or PPI ÷ 160 for wide, unfolded screens), in 1/8 steps |
| Tablets, e-readers | PPI ÷ 160, in 1/8 steps |
| Monitors | PPI ÷ 110, in 1/4 steps |
| Laptops, tablet PCs | PPI ÷ 130, in 1/4 steps |

### 5.5 Reference percentages (`refPct`, `fmtPct`)

`(value ÷ reference − 1) × 100`, rounded to a whole number, with `+` or a real minus sign (`−`); 0% has no sign. A missing, zero or inapplicable value shows a dash (`–`).

## 6. Text and PDF processing

### 6.1 E-book layout

`ebookText()` measures each word of the `AUSTEN` passage once with canvas `measureText()` in the serif font (`PROSE_FONT`), in ems, plus the font's cap height and x-height when the browser reports them (0.7 and 0.47 em otherwise). `layoutEbook()` wraps the words into lines and columns (first-line indent 1.5 em) and caches the result (`EBOOK_LAYOUTS`). The preview draws exactly those lines, and the card's counts come from the same layout. The passage repeats from the start if a huge screen runs out of text.

### 6.2 Page previews

Lorem text is real SVG `<text>`, ragged right. `PROSE_EM` measures the browser's real serif width so lines wrap correctly. Below 3.5 px (`TEXT_MIN_PX`) text becomes gray bars.

### 6.3 Crop white margins

`pageInk()` renders a page at 800 px on the long side, finds the most common color (the background), marks cells of 4 × 4 px as ink when 40+ levels away, drops specks under 3 cells, ignores ink in the outer 1.5% band unless it joins content further in, and adds a 0.12 in safety margin. `scanDoc()` samples up to 12 pages for a typical cropped size and odd/even placement. `prepareCrop()` sets crops for the pages on screen; `paperDims()` then returns the cropped page. Pages without a clear background (photos) aren't cropped.

## 7. Reference comparison

`S.ref` holds the `uid` of the reference card or `null`. `save()` drops it when that card leaves `S.sel`. The table (`#ref-panel`) appears with a reference and at least two screens; its tabs use `REF_COLS` and default to the preview mode. The temporary tab selection resets when the preview or reference changes. The Pages tab uses the saved paper or loaded PDF dimensions and prompts for input when neither is available. Share links mark the reference with `r: 1` on its `sel` entry.

## 8. Dependencies, caching and offline behavior

### 8.1 Outside dependencies

| Dependency | Where | When |
|---|---|---|
| pdf.js 6.5.438 legacy | In the repo, `pdfjs/6.5.438/` | Only when a PDF is opened |
| GoatCounter | `gc.zgo.at` script, GitHub copy only | Every visit (analytics) |
| Playwright, axe-core | `tests/package.json` | Tests only, never on the site |

No CDN, font service, API or backend.

### 8.2 pdf.js loading

`PDFJS` names the versioned folder. `pdf.min.mjs` loads with `import()`, parsing runs in a module Web Worker, and `getDocument()` gets `wasmUrl` so JBIG2 scans and JPEG 2000 images decode. Opening a new PDF destroys the previous loading task and its worker. `index.html` adds a `Response.prototype.bytes` shim for Safari 17.4–17.x.

### 8.3 Service worker (`sw.js`)

| Request | Strategy | Cache |
|---|---|---|
| The page (`./`, `index.html`), `methodology.html` and `devices.csv` | Network first with `cache: "no-cache"`; after 3 s or on failure, the saved copy | `tss-core-<VERSION>` |
| Icons, manifest, favicon (plus the three above) | Saved on install, then cache first | `tss-core-<VERSION>` |
| `pdfjs/<PDFJS_VERSION>/` | Cache first; the whole reader including decoders is saved the first time a PDF opens | `tss-pdfjs-<PDFJS_VERSION>` |
| Other `pdfjs/` versions | Network only, never saved | none |
| Other origins (analytics) and non-GET | Not handled | none |

On activate, every `tss-` cache other than the current two is deleted. If an older version had saved the PDF reader, the new worker saves the new one on install. `skipWaiting()` and `clients.claim()` make updates take over at once.

### 8.4 Local storage

| Key | Content |
|---|---|
| `tss:state` | The saved `S` (selection, modes, positions, paper, zoom, reference...) |
| `tss:custom` | Custom screens: `{id: "c-<timestamp>", n, d, w, h, aspectOnly?}` |
| `tss:ppiCal` | Calibrated CSS px per inch (50–260) |
| `tss:ppiCalDpr` | `devicePixelRatio` at calibration time |

All reads go through `store.get` with try/catch, and are validated before use.

## 9. Share links

`#s=` + base64url of a JSON object with `SHARE_KEYS` (modes and options), `sel` (`i` device ID, `f` flip, `s` spread, `t` fit, `c` columns, `r` reference), `pos` (free-arrange positions, arrange mode only) and `cu` (custom screens in the selection). An uploaded PDF is replaced by US Letter. Calibration is never included. The receiver's page merges `cu` into its own custom screens, validates everything, then clears the address. Old links must keep working, so fields can be added but not renamed or reinterpreted.

## 10. Tests and deployment

- Tests: `tests/README.md` lists each test file, what it covers and which one to run for a change. `tests/lib/app.js` extracts named functions from `index.html` by text for `unit.js`; `.github/workflows/tests.yml` runs `run-all.js` on pushes to `main` and on pull requests.
- **Deployment:** merging to `main` publishes the site through GitHub Pages ("pages build and deployment" action). There is no staging site. Claude can generate a temporary Artifact preview of a branch from `index.html` (no offline, no analytics).
