# Changelog

Significant changes to True Size Screens, newest first. The full detail is in the git history; the reasons are in [`docs/DECISIONS.md`](docs/DECISIONS.md). Add a line here in the same pull request as any significant change.

## Unreleased

- Reference comparison tabs let you compare screen size, pages, video, e-books and websites without changing the preview.
- Fixed "Compare with my screen" so it can suggest matching tablet PCs on touch devices.
- Docs: shared instructions for all AI coding agents (`AGENTS.md`), plus `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/HANDOVER.md` and this changelog. New development protocol: a branch and pull request per task, and Thomas approves every merge (replaces committing straight to `main`). No change to the website.
- The repo's `index.html` is now the only source; Claude's old project-folder copy and its `wrap.sh` build script are retired, and Claude's Artifact preview is generated from the repo file.

## 2026-11-27

- Megapixels on cards and in the reference table; video cards show the picture's diagonal and area without the black bars; new Methodology page linked in the footer, saved for offline use (service worker v3).
- Reference screen: "Set as reference" on any card shows how the others compare, in percent, for the current content mode. Saved and included in share links.
- GitHub's language bar counts only the project's own code (`pdfjs/` marked as vendored).
- Device audit integrated: all 315 rows checked, no sizes changed, 58 screens added, 6 grouped names gained models (old IDs redirect through `RENAMED`), Surface Duo moved to Phones, iPhone 4/4s get 2× website scaling.
- Calibration: exact bank-card size (85.60 × 53.98 mm), card upright on phones, − and + fine-tune buttons, percentage of actual size shown, invalid saved values fall back safely.
- Tests: WebKitGTK runner and an in-page PDF check that runs on real iPhones; Safari 17.4+ noted as the floor for PDF previews.
- Tests: unit and browser regression suites, run on GitHub for pushes and pull requests. Bugs they found and fixed: "Galaxy S26+" and similar shared an ID with the base model; malformed saved settings or calibration broke the page; free-arrange positions were lost when the device list loaded slowly; choosing a second PDF while the first loaded could show the wrong one.
- pdf.js updated from 3.11.174 to 6.5.438, legacy build (the standard build fails on iOS Safari), in a folder named after its version, with JBIG2/JPEG 2000 decoders; offline caches are versioned and old ones deleted.
- "Crop white margins" option for PDFs.
- E-book mode measures real text for its counts, uses a Pride and Prejudice passage, picks auto columns from real line length, and shows cap and x-height.
- Smoke test (`tests/smoke.js`).
- Works offline: service worker for the page, device list, icons and (once opened) the PDF reader.
- pdf.js hosted in the repo instead of cdnjs, and loaded only when a PDF is opened.
- Click a listed device again to remove it. Device list sorted by category, brand, family and newest first.
- Surface lineup additions (Laptop 6, Studio, Book with Performance Base) and Microsoft's default display scaling for website previews.
- Page and e-book previews show real Lorem ipsum text at true size.
- "Compare with my screen" works on tablets, laptops and monitors, with closest matches and an enter-your-own fallback.
- Decided not to collect visitor-added devices; custom screens stay in each visitor's browser.

## 2026-11-26

- Phone improvements: compare with my phone, pinned content switch on a sticky quick bar, share links, Add to Home Screen, iOS fixes.
- New devices: 2026 ThinkPads, Xiaomi 17 Ultra and others, MacBook Neo, every recent foldable (inner and cover screens).
- Simpler first visit: iPad mini and iPad Pro 11, both portrait, Letter page.
- Keyboard controls for Free arrange; accessibility fixes (contrast, drawing description, focus, ARIA); phone layout with bigger tap targets.
- MIT license, favicon, link-preview image, feedback link; footer with copyright, trademark and privacy notes; GoatCounter analytics.
- Card reordering by drag and drop, sort by screen height.
- Video, e-book and website preview modes, with per-screen e-book columns.

## 2026-11-25

- Paper, book and card sizes, and a page size menu built from them.
- Up to 12 screens at once; shortest-first ordering; PDF previews centered, Fit width and 100% start at the top.
- Device list moved to `devices.csv`; site published on GitHub Pages.

## 2026-11-24 (preview only, before the repo)

- First version: screens compared at true relative size with PPI, side by side, overlay and free arrange, PDF page previews.
