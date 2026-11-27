# Decisions and constraints

Why True Size Screens works the way it does, and what future developers (human or AI) must respect. How the code implements these is in [`ARCHITECTURE.md`](ARCHITECTURE.md); the visitor-facing explanation is [`methodology.html`](../methodology.html).

Each topic separates four kinds of statement:

- **Fact (verified):** checked against a source, a test or a real device.
- **Decision:** a deliberate choice, with the reason, the alternatives considered (where known) and who decided.
- **Estimate:** an approximation the site knowingly makes.
- **Open question:** not yet settled or not yet checked.

To change a decision, describe the conflict to Thomas first (`AGENTS.md`, rule 11), then update this file in the same pull request. Dates are 2026 unless stated.

---

## 1. Physical dimensions, resolution and pixel density

**Facts**
- Physical size is derived only from the diagonal and the native pixel counts: PPI = √(w² + h²) ÷ diagonal; sides = diagonal × w (or h) ÷ √(w² + h²). Hand-checked in `tests/unit.js` (for example "Test 13": 13 in, 1200 × 500 px → 12 × 5 in at 100 PPI).
- Megapixels = native width × height ÷ 1,000,000 (two decimals). Null for paper and aspect-ratio-only screens.

**Decisions**
- **Outlines show the active screen area only, never bezels**, as a plain rectangle (notches, punch holes and rounded corners aren't drawn). Reason: diagonal and resolution are what spec sheets publish reliably; bezel sizes aren't.
- **Diagonal convention:** the maker's figure for the full rectangle of the active area, at the maker's precision. Apple's "measured as a rectangle" figure is used (iPad Pro 11-inch is 11.1, MacBook Air 13" is 13.6). Samsung's full-rectangle figure is used, not its smaller "rounded corners" one.
- **Color e-ink** rows keep the monochrome (full panel) resolution, because text is drawn at it. The CSV has no separate color resolution.
- No hidden per-device corrections: what's in the CSV is what's drawn.

**Estimates**
- Diagonals are rounded marketing figures, so sizes are accurate to about 1–2%.

**Open questions**
- None at present.

## 2. Device database: verification and source reliability

**Facts**
- `devices.csv` (header exactly `name,type,diagonal,width,height`) is the source of the built-in list. The README's count must match it (unit test).
- **Device audit (27 Nov):** all 315 original rows were checked (Gemini web research, one pass for most batches; two passes plus adjudication for Apple and Android tablets; deterministic checks by script; Claude reviewed the exceptions). No existing size changed, 58 devices were added, 6 grouped names gained models (with `RENAMED` entries) and Surface Duo moved to Phones. Records and tools are on the `device-database-audit` branch, folder `device-audit/` (`DATABASE_CONTRACT.md` describes the format, IDs and compatibility rules in full; `validate_db.py` checks any list).
- Unit tests check PPI ranges per category (phone 200–600, tablet 120–400, e-reader 150–350, tablet PC 100–450, laptop 90–350, monitor 50–250), shape at most 4:1, unique names and IDs, and valid `RENAMED` targets.

**Decisions**
- **Devices live in a CSV, not in the code**, so non-programmers can add or fix a device on GitHub.
- **Source hierarchy:** the maker's own spec page or newsroom first; one maker source is enough. Differences under 0.5% in size are accepted. Uncertain rows are kept and marked in the audit records rather than changed (Thomas, 27 Nov).
- **Unreleased or rumored devices are left out** (for example the iPad 12th gen, as of Nov). Rumor sites and leaks never count.
- **One row per distinct screen.** Models with identical screens may share a row with every model in the name, because search only matches the name (no hidden aliases). Foldables have one row per screen (`(inner)`, `(cover)`); dual-screen devices are `(one screen)`.
- **Sorting:** Tablets, Phones, E-readers, Tablet PCs, Laptops, Monitors, Paper; then Apple, Samsung, Microsoft, Lenovo, Google, others, generic; product families together, newest first. Row order is what visitors see inside each category.
- **Visitor-added devices are not collected** (27 Nov). Alternatives considered and declined as not worthwhile: a prefilled GitHub issue, a form service, a serverless pending list. The footer's "Tell me" GitHub issue link covers missing devices.
- **No database expansion without approval** (new devices, new columns, new fields). Recommended future columns (`source_url`, `reported_ppi`, `color_ppi`, `status`, ...) are described in `DATABASE_CONTRACT.md` section 10 but not adopted.

**Constraints**
- Device IDs are `slug(name)`, where "+" becomes "plus" (until Nov, "Galaxy S26+" and "Galaxy S26" shared an ID, so one couldn't be picked; `unit.js` now checks that no two names make the same ID). IDs are stored in visitors' saved settings and in share links that can't be updated. A rename changes the ID, so the old ID goes into `RENAMED` (one hop: retarget older entries too). Never reuse an ID for a different screen. Keep the first-visit IDs (`ipad-mini-a20-pro-2026`, `ipad-pro-11-inch-m4-m5`, `us-letter-paper`) working.
- Names drive code: `dprOf()` (`^iPhone`, `^iPad`, `^MacBook`, `Surface RT/Laptop Go/Laptop SE/Studio`...), the Mac filter in "Compare with my screen" and the paper menu groups. Check them before renaming.
- `parseCsv` is line-based: no line breaks inside quoted cells.

**Estimates**
- AI research is fallible. Lesson from the audit: AI researchers called real recent products "rumored" (2025 Kindle Scribe, 2026 Kindles) and misread Samsung's full-rectangle footnote. Check the maker's newsroom before believing them.

**Open questions**
- `DATABASE_CONTRACT.md` section 5 (on the audit branch) still says `devices.csv` is generated from `raw.json`; that is out of date. Since the audit, `devices.csv` itself is the source and `gen_csv.py` only sorts it.
- Grouping is inconsistent (for example Galaxy Tab S8–S11 Ultra are separate rows with the same screen). Left as is; report, don't merge.

## 3. Browser calibration and actual-size rendering

**Facts**
- CSS defines 96 px per inch, but real screens differ, so "Actual size" without calibration is only approximately real size.
- The calibration card is ID-1, exactly 85.60 × 53.98 mm (ISO/IEC 7810).
- Desktop Chrome, Edge and Firefox change `devicePixelRatio` with page zoom, so a changed ratio reveals that a calibration is out of date.

**Decisions**
- **Calibrate with a bank card** (`CARD_MM`, 27 Nov), because almost everyone has one. Earlier versions used 3.370 × 2.125 in (within 0.005 mm).
- The card is drawn upright below `CAL_UPRIGHT` (long side at 165 px per inch), because lying sideways it's wider than any phone. − and + buttons move in 0.5 px-per-inch steps (about 0.3%) for fingers. Done confirms the current value, even exactly 96.
- **Calibration only sets the drawing scale in "Actual size".** It never changes a card number or a reference percentage.
- It is stored on its own (`tss:ppiCal`, 50–260, plus `tss:ppiCalDpr`), kept by "Reset to start", and **never put in share links**, because it belongs to the visitor's screen.
- Invalid saved values fall back to the default; saved zoom and scale are validated (`ZOOM_MIN`–`ZOOM_MAX`).

**Estimates**
- Uncalibrated "Actual size" assumes 96 CSS px per inch.

**Open questions**
- **iPhone and iPad Safari may not change `devicePixelRatio` with page zoom** (aA menu), so the site may not notice that calibration went out of date. The hint tells visitors to recalibrate. Not yet checked on a real iPhone.
- Safari may clear saved settings for a site not visited in 7 days (resetting calibration); a Home Screen app keeps them.
- On iPhone SE the calibration panel scrolls by about 3 px (reported, not fixed).

## 4. Display scaling and aspect ratios

**Facts**
- Aspect ratio comes from the pixel counts; the loader stores the larger count as width, so row orientation in the CSV doesn't matter. Orientation is a stage setting, with per-card rotation.
- On touch devices, "Compare with my screen" can suggest phones, tablets and tablet PCs. The matcher uses the loader's internal category `tabletpc` and lists touch phone and tablet shape matches before tablet PCs.

**Decisions**
- Website previews use an estimated display scaling per device (`dprOf()`): Apple devices by name (iPhone 3× or 2×, iPad 2×, MacBook PPI ÷ 127, iMac and Apple displays 2×), a few Surface models by Microsoft's defaults (RT, Laptop Go, Laptop SE 1×; Studio 2×), then by category (phones about 412 CSS px wide, tablets and e-readers PPI ÷ 160, monitors PPI ÷ 110, laptops and tablet PCs PPI ÷ 130).
- **Website previews are generic and unbranded** (news, search, social, shop, wiki) to avoid trademark issues and stay original.
- A custom scaling input was considered and not built.

**Estimates**
- All `dprOf()` values are approximations of default settings; visitors can change scaling, so previews show roughly what fits.
- "Compare with my screen" is a best guess from `screen.width × devicePixelRatio`, which scaling and zoom change. On a Mac it matches by aspect ratio only, then filters to Apple models.

## 5. PDF rendering, cropping and compatibility

**Facts**
- pdf.js 6.5.438 **modern** build calls JavaScript iOS Safari lacks (for example `Map.getOrInsertComputed`). The **legacy** build supports Safari 18+ officially and works from Safari 17.4 in testing. It does not polyfill `Promise.withResolvers` or `ArrayBuffer.prototype.transferToFixedLength` (pdf.js issue 22279, closed as not planned), so it fails on Safari 16.4–17.3, and it can't be parsed before Safari 16.4 (static class blocks).
- Tested in WebKitGTK 2.44 (Safari 17.4-era engine) and 2.52, and by Thomas on a real iPad mini 5 (iPadOS 18) and iPhone (iOS 27). GoatCounter showed 0 of 21 sampled visits below the supported range (Nov).
- `isEvalSupported` was removed in pdf.js 5.7; pdf.js never turns PDF content into code.

**Decisions**
- **PDFs never leave the browser.** pdf.js renders locally; nothing is uploaded or saved, and share links replace a PDF with US Letter.
- **pdf.js loads only when a PDF is opened** (it's the biggest download: about 155 KB plus a 395 KB worker compressed, and up to 150 KB of decoders) because most visitors never open one.
- **pdf.js is hosted in the repo**, not on a CDN (it was on cdnjs until 27 Nov), so the site depends on no outside service.
- **Legacy build, version 6.5.438** (27 Nov). Alternative considered: the modern build (breaks iOS Safari); a two-feature shim for Safari 16.4–17.3, deferred until such visitors appear (Thomas). `index.html` adds `Response.prototype.bytes` for Safari 17.4–17.x.
- **The pdf.js folder is named after its version** so a page can never load a worker or decoders from another version. Upgrades follow the README steps.
- **Crop white margins** (Thomas, 27 Nov): one checkbox, off by default, no manual controls. Background = most common color (so off-white scans work); 40+ levels away = ink; groups under 3 cells (4 px each) are dust; ink in the outer 1.5% band counts only if it joins content further in; 0.12 in safety margin. Every page gets the same cropped size (the largest content of up to 12 sampled pages, skipping one outlier such as a cover), placed per odd/even page so mirrored book margins crop well, grown for any page with more content. Pages without a clear background (photos) aren't cropped. The crop applies to Fit page, Fit width and card stats; 100% keeps printed scale.

**Open questions**
- No CMap or standard-font files are shipped: PDFs relying on non-embedded CJK fonts may show wrong or missing text.
- Watch pdf.js issue 22572 (Safari 27 font cache, in pdf.js's viewer).

## 6. E-book line and word count estimation

**Facts**
- Counts come from a real layout: each word of the sample passage is measured with canvas `measureText()` in the visitor's serif font, then wrapped. The preview draws exactly those lines, so preview and counts always agree and don't change with zoom.

**Decisions**
- Sample text: *Pride and Prejudice*, chapter 42 to the start of chapter 43 (public domain), repeated if a huge screen runs out.
- Layout: 0.3 in margins, 0.5 in column gap, line height 1.5 em, first-line indent 1.5 em.
- **Auto columns aim for 45–75 characters per line**, choosing one or two columns, whichever is closer.
- "Lines per screen" in the reference table counts every column; the card shows lines per column.
- Lorem ipsum previews use real SVG text, ragged right: `textLength` justification made redraws about 10× slower.

**Estimates**
- Real e-readers use their own fonts, margins and hyphenation, so counts are indicative.
- Line breaks differ slightly between devices because the serif font differs (Georgia on iPhone, Times on Linux). Cap height and x-height use the font's real metrics where the browser reports them (0.7 and 0.47 em otherwise).

## 7. Offline operation and service-worker caching

**Facts**
- `sw.js` serves the page, `methodology.html` and `devices.csv` network-first (3-second limit, then the saved copy); icons and the manifest cache-first; pdf.js cache-first in its own versioned cache, saved whole on first PDF use. Each new version deletes older `tss-` caches. Tested offline in `smoke.js` and `browser.js`, and in WebKitGTK.

**Decisions**
- **Fresh when online**, so changes to `index.html` and `devices.csv` reach visitors without bumping anything.
- **Bump `VERSION`** after changing `sw.js` itself, an icon, the manifest or the list of saved files (it is v3 since the methodology page). A pdf.js upgrade changes `PDFJS_VERSION` instead.
- The service worker is registered only on the live site; Claude's generated Artifact preview leaves the registration out.

**Open questions**
- A tab left open across a pdf.js upgrade can't open its first PDF until reloaded (old files are deleted); it says "The PDF reader didn't load". Accepted.

## 8. Custom devices and local browser storage

**Decisions**
- Visitors can enter their own screen (diagonal plus resolution, or plus aspect ratio only, which has no PPI). It's stored only in their browser (`tss:custom`, IDs `c-<timestamp>`) and travels inside share links (`cu`). Never collected (section 2).
- All saved data uses the `tss:` prefix: `tss:state`, `tss:custom`, `tss:ppiCal`, `tss:ppiCalDpr`.
- **Everything loaded from storage or a share link is untrusted** and sanitized (`isObj`, `okScreen`, `okCal`); a malformed part is dropped, not trusted. At most 12 screens.
- **Backward compatibility:** saved settings and share links from older versions must keep working (a frozen old link is tested). Fields may be added, not renamed or reinterpreted.
- **Default first visit:** iPad mini (A20 Pro) and iPad Pro 11" (M5), both portrait, with a Letter page fit. A short page suits phone visitors (Thomas, 26 Nov).

## 9. Regression testing and deployment

**Facts**
- `node tests/run-all.js` runs `unit.js`, `smoke.js` and `browser.js` (425 checks after the 27 Nov Phase 2 change). GitHub Actions runs it on pushes to `main` and on pull requests.
- Automated browser tests use Chromium, including iPhone 13 emulation, which is not real Safari. `webkit.js` (WebKitGTK) and `browser-check.html` (on a real iPhone) cover the PDF path.

**Decisions**
- **Static site, one file, no build step**, so Thomas can edit on GitHub directly; it loads fast (about 37 KB compressed per visit).
- **Deployment = merge to `main`** (GitHub Pages, root folder). There is no staging site.
- **The repo's `index.html` is the only source** (Thomas, 27 Nov, after Codex's review of the collaboration docs). Until then Claude edited a copy without the `<head>` in its project folder and rebuilt the repo copy with `wrap.sh`; an edit made only in the repo (by Codex, say) could have been overwritten by the next rebuild. Alternatives considered: moving `wrap.sh` into the repo (rejected: it keeps a second editable copy and adds a build step), or keeping the old workflow with a sync rule (rejected: easy to forget). Claude's Artifact preview is now generated from the repo file by a one-line command and never copied back. No build system, framework or dependency was added for it.
- **Branch per task, pull request, Thomas approves every merge** (27 Nov). This replaces the earlier practice of committing straight to `main`. See `AGENTS.md`.
- Every bug fix gets a regression test; tests are never weakened.
- Accessibility is required: 4.5:1 text contrast in both themes, full keyboard use, axe-core clean.
- Phones first (about 79% of visitors on phones, 95% Safari): sticky quick bar, "More options" toggle, 44 px touch targets, 16 px inputs.

**Open questions**
- Some things need a real iPhone after big changes (`tests/README.md`, "What still needs a real device").

## 10. Reference-device comparisons

**Decisions** (Thomas, 27 Nov)
- One "Set as reference" button per card, no reference by default, one at a time.
- Percentage = (value ÷ reference − 1) × 100, whole numbers, `+` or a real minus sign; 0% never shows a sign.
- A missing, zero or inapplicable value (no pixel count, a paper sheet, a zero reference) shows a dash, never 0% or −100%.
- Green for positive percentages, red for negative percentages and neutral text for 0%, baseline and unavailable values. Signs convey direction without color. The note explains that the percentages describe how much a value changes.
- Tables use the same calculation functions as the cards. Calibration, zoom and drawing scale never affect them. Screen size shows native resolution, compares total pixels in the Megapixels column, and compares aspect ratio by long edge divided by short edge.
- All five comparison tabs are available as soon as a reference table is visible. The preview mode selects the initial tab and changing the preview selects its corresponding tab. Selecting a tab only changes the table, calculating that mode with the saved settings and the comparison values below. The tab selection is temporary. Pages prompts for a page size or PDF when needed.
- Pages compares apparent 12 pt text at both Fit page and Fit width for the selected page or spread. Each Pages row shows the page count and the selected fit used for visibility. Video compares screen coverage at 16:9, 2.39:1, 4:3 and 9:16. E-book uses 12 pt (medium) and the saved column settings. Website layout is shown as a label.
- Each row shows the screen’s current orientation next to its name.
- The reference is saved, marked in share links (`r: 1`) and cleared whenever its card is removed.

## 11. Originality, privacy and licensing

**Decisions**
- Inspired by what comparisontabl.es does, but never copy its look, wording or code.
- Only outside service: GoatCounter analytics (privacy-friendly, GitHub copy only; tests block it).
- MIT license, © 2026 DidymusMonk. pdf.js is Apache-2.0, decoders under their own licenses.
- `.gitattributes` marks `pdfjs/` as vendored so GitHub's language bar counts only this project's code.
