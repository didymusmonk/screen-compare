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
| `sw.js` | Service worker for offline use. The page and `devices.csv` load fresh when online (3-second limit, then the saved copy). Everything else is saved on first load. Registered only in the GitHub copy, by `wrap.sh` |
| `favicon.svg`, `og-image.png` | Tab icon and link-preview image |
| `pdfjs/` | pdf.js 3.11.174 (`pdf.min.js`, `pdf.worker.min.js`, Apache-2.0 `LICENSE`), copied unchanged from the `pdfjs-dist` npm package |
| `tests/smoke.js` | Saved Playwright smoke test (desktop + iPhone 13): devices, search, modes, share link, PDF, phone layout, axe-core, offline, JS errors. Run `node tests/smoke.js`; setup in `tests/README.md`. Not part of the site |
| `README.md`, `LICENSE` | Public description and the MIT license (© 2026 DidymusMonk) |

Inside `index.html`, all state lives in one object, `S`, and is saved to `localStorage` under the `tss:` prefix. Every change calls `save()` and then `renderAll()`, which redraws the category list, search results, the SVG stage and the cards. Main functions:

- `parseCsv` / `loadDevices`: read `devices.csv`. The `RENAMED` map keeps old saved IDs working after a device is renamed.
- `geom(dev, flip)`: physical width and height in inches, from the diagonal and the pixel aspect ratio.
- `renderStage`: draws the SVG stage in three modes: side by side, overlay, or free arrange (drag, snapping guides, rotation, keyboard moves).
- `drawPage` / `drawVideo` / `drawEbook` / `drawSite`: draw the content previews. `lorem()` supplies the lorem ipsum text for page previews.
- `ebookText` / `layoutEbook` / `ebookFit`: the e-book mode. `AUSTEN` holds the sample passage (Pride and Prejudice, ch. 42 to the start of ch. 43). `ebookText()` measures each word once with canvas `measureText()` (in ems), and `layoutEbook()` wraps it into lines and columns. The preview draws exactly those lines, and the card's words, lines and characters per line come from the same layout, so they always agree and don't change with zoom.
- `dprOf(dev)`: estimates each device's display scaling (CSS pixels) for the website previews.
- `renderCards`: the info card for each selected screen.
- `shareUrl` / `fromShare`: share links in the form `#s=<base64url JSON>`.
- `myScreenMatches` / `setupMyPhone`: the "Compare with my screen" feature.
- `loadPdfjs` / `openPdf`: the PDF preview. `pdfjs/pdf.min.js` loads only when a PDF is opened, and the parsing runs in a background Web Worker (`pdfjs/pdf.worker.min.js`).

## Key decisions and why

- **One file, no build.** The owner is new to coding and can edit it on GitHub directly. It also loads fast, at about 37 KB compressed per visit.
- **Devices live in a CSV, not in the code.** This lets non-programmers add or fix a device on GitHub (the README explains how).
- **Outlines show the screen area only, never the bezels.** The size comes from the diagonal and the pixel aspect ratio, because those are what spec sheets publish reliably.
- **PDFs never leave the browser.** pdf.js renders them locally. It loads on demand because most visitors never open a PDF, and it is the biggest download (about 90 KB plus a 290 KB worker, compressed). It is hosted in the repo, not on a CDN, so the site depends on no outside service.
- **The website previews are generic and unbranded** (news, search, social, shop, wiki) to avoid trademark trouble and to stay original.
- **The default first visit shows only two screens:** iPad mini (A20 Pro) and iPad Pro 11" (M5), both portrait, with a Letter page fit. A short page suits phone visitors.
- **Lorem text is drawn as real SVG `<text>`, ragged right.** `textLength` justification made redraws about 10× slower. `PROSE_EM` measures the browser's real serif width so that lines wrap correctly. Below 3.5 px, the text turns into gray bars (in e-book mode, bars the length of the real lines).
- **E-book auto columns aim for 45–75 characters per line.** Auto lays the text out in one and two columns and picks the one whose real line length is closer to that range, so it reacts to font size and screen width. The passage repeats from the start if a huge screen at a tiny size runs out. The letter heights on the cards use the font's real cap height and x-height where the browser reports them (0.7 and 0.47 em otherwise).
- **Unreleased devices are left out** (for example, the iPad 12th gen as of Nov 2026).
- **The device list is sorted** by category (Tablets, Phones, E-readers, Tablet PCs, Laptops, Monitors, Paper), then by brand (Apple, Samsung, Microsoft, Lenovo, Google, then others, then generic), with product families kept together and the newest models first.

## Conventions

- To upgrade pdf.js, replace both files in `pdfjs/` with a matching pair from the same `pdfjs-dist` version (and the Artifact preview's extra files). Version 4+ ships as ES modules (`.mjs`), so moving to it needs code changes.
- Plain JavaScript with small helpers: `$` for querySelector, `esc()` for HTML escaping, and the `store` wrapper for localStorage.
- Every user-facing string is plain English in sentence case. Avoid jargon, or explain it in the glossary.
- Accessibility is required. Text contrast must be at least 4.5:1 in both themes, every control must work by keyboard, and the SVG stage has an `aria-label`. Arrange mode announces changes through `#sr-live`, and focus is restored after redraws. Check changes with axe-core.
- Phone layout (≤700 px): sticky `#quickbar`, a "More options" toggle, touch targets of at least 44 px, and 16 px inputs so iOS doesn't zoom in.
- If a change to `sw.js` itself, or to a file it saves on first load (icons, `pdfjs/`), must reach visitors who already have it saved, bump `VERSION` in `sw.js`. Changes to `index.html` and `devices.csv` show up without that.
- Device rows in the CSV are `name,type,diagonal,width,height`. Paper rows leave `diagonal` empty and give inches. Keep the README's device count in sync.
- Commit straight to `main` with a short, plain-English message.

## How the files are produced (owner's Claude workflow)

The working copies sit outside the repo, in a Claude project folder (`/mnt/project-files/screen-compare/`):

- `index.html` there is the **Artifact preview source**. It has no `<!doctype>`/`<head>` wrapper. Preview: https://claude.ai/artifact/WhqeFfcgT7a4HBnUySpaFa (publish it with `devices.csv` as an extra file).
- `wrap.sh` builds the repo's `index.html` from that source. It adds the doctype, meta description, Open Graph and Twitter tags, favicon, canonical link, manifest and Apple tags, theme color, and the service worker registration and the GoatCounter script (both in the GitHub copy only). Always rebuild with it. Don't hand-edit the two copies separately.
- `gen_csv.py` + `raw.json` generate and sort `devices.csv`.
- Run `node tests/smoke.js` after every change (it serves the repo itself). Add a check there when a new feature ships. One-off Playwright scripts are still fine for deeper checks such as touch drag.

## Known issues and limits

- **Opening `index.html` straight from disk (`file://`) shows no devices**, because browsers block `fetch()` of local files there. Use a local web server.
- **"Compare with my screen" is a best guess.** It uses `screen.width × devicePixelRatio`, which display scaling and browser zoom can change. On a Mac it only matches by aspect ratio, then filters to Apple models.
- **The `dprOf()` display-scaling values are approximations**, so website previews show roughly what each device fits, not exactly.
- **Diagonals are rounded marketing figures**, and some panels have rounded corners or notches. The sizes are accurate to about 1–2%.
- **Sample text width depends on the visitor's serif font.** Because it is measured, the wrapping stays sensible, but line breaks and e-book counts differ a little between devices (Georgia on iPhone versus Times on Linux, for example).
- **The project folder adds C2PA metadata to SVG files written there**, which bloated `favicon.svg` from 316 bytes to 8 KB. Edit `favicon.svg` in the repo itself and don't copy it back from that folder.
- **The README's device count is updated by hand.**

## Next steps (ideas, not commitments)

- Add new devices as they ship (iPad 12th gen when it's released, 2027 phones).
- A search for "devices similar in size to X".
