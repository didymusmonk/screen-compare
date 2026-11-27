# Handover

What a new developer or AI agent needs to know about the current state. Update it when a bug, limitation or fragile area changes; leave counts and recent history to `README.md`, `CHANGELOG.md` and git. Rules are in [`../AGENTS.md`](../AGENTS.md); reasons in [`DECISIONS.md`](DECISIONS.md).

## Current status

- The site is live at https://didymusmonk.github.io/screen-compare/ and feature-complete for its current scope: built-in screens and paper sizes (counts in `README.md`), side by side / overlay / free arrange, pages and PDFs (with margin cropping), video, e-book and website previews, reference comparison, megapixels, calibration, share links, offline use and Add to Home Screen, plus a Methodology page.
- Recent changes are listed in `CHANGELOG.md`; open work is in GitHub's open pull requests.
- The automated tests (`unit.js`, `smoke.js`, `browser.js`) pass on `main`, and GitHub Actions runs them on every pull request.
- The device database audit (27 Nov) is merged into `devices.csv`; its working records stay on the `device-database-audit` branch.
- Every change goes through a branch and a pull request that Thomas approves, and the repo's `index.html` is the only source.

## Known bugs and limitations

Bugs (not fixed yet):

1. **iPhone SE: the calibration panel scrolls by about 3 px.** Cosmetic.
2. **`index.html` has two `<meta name="description">` tags**: the live-site one near the top and an older, shorter one after `<title>`. Search engines normally use the first. Harmless, left as is (removing it is a visitor-facing change for a separate task).
3. **The "PDF reader didn't load" message says Safari 18**, while testing shows 17.4+ works. Conservative wording, not wrong for visitors.

Limitations (accepted; details in `DECISIONS.md`):

- Opening `index.html` from disk (`file://`) shows no devices; use a local web server.
- Sizes are accurate to about 1–2% (rounded marketing diagonals; notches and rounded corners not drawn).
- Display scaling for website previews (`dprOf()`) and "Compare with my screen" are estimates.
- E-book counts and line breaks vary a little with the visitor's serif font.
- PDF previews need Safari 17.4+ or a current Chrome, Edge or Firefox; older browsers see "The PDF reader didn't load" and the rest works.
- No CMap or standard-font files, so some CJK PDFs may show wrong text.
- A tab left open across a pdf.js upgrade must be reloaded before its first PDF.
- Calibration may not notice Safari page zoom on iPhone and iPad (not checked on a real device). Safari may clear saved settings after 7 days without a visit (Home Screen apps keep them).
- Automated tests run in Chromium with iPhone emulation, not real Safari. WebKitGTK and the real-iPhone check page cover the PDF path only.
- The README's device count is updated by hand (a unit test catches a mismatch).

## Work underway

Check open pull requests and branches on GitHub before starting: an open pull request is someone's active work (`AGENTS.md` rule 4).

## Fragile or sensitive areas

| Area | Why it's fragile | Where |
|---|---|---|
| Device IDs and `RENAMED` | IDs live in visitors' saved settings and in share links that can't be updated. A rename without a `RENAMED` entry silently drops that screen. `RENAMED` is one hop only. | `slug`, `RENAMED`, `OLD_PAPER_IDS`, `devices.csv` |
| Device names used as code | `dprOf()`, the Mac filter in `myScreenMatches()` and the paper menu match on name patterns. | `index.html` |
| Share links and saved settings | Old formats must keep working; all input is untrusted and must be sanitized and escaped (`esc()`), including custom screen names arriving through `cu`. | `shareUrl`, `fromShare`, `isObj`, `okScreen`, `okCal` |
| Service worker | A mistake can keep stale files on visitors' phones or break offline use. `VERSION`, `PDFJS_VERSION` and `PDFJS` must agree. | `sw.js` |
| pdf.js | Must stay the legacy build; folder, `PDFJS` and `PDFJS_VERSION` change together; Safari 17.4 floor. | `pdfjs/`, `loadPdfjs`, `openPdf` |
| PDF loading races | Quick page turns and swapping PDFs mid-load were real bugs; tests cover them. | `openPdf`, crop code |
| E-book layout | Counts depend on canvas text measurement and caching; preview and counts must stay in step. | `ebookText`, `layoutEbook`, `ebookFit` |
| `statsOf()` | Shared by cards and the reference table; must never read zoom or calibration. | `index.html` |
| Test extraction | `tests/lib/app.js` copies functions by text: top-level declarations start at column 0 and multi-line ones end with a line starting `}` or `]`. Reformatting breaks `unit.js`. | `index.html`, `tests/lib/app.js` |
| `index.html` head and closing scripts | Tags above `<title>` and the two scripts before `</body>` are live-site only; Claude's preview generator relies on the `<title>` line and the one-line service worker registration as markers. Removing the service worker line breaks offline use. | `AGENTS.md` section 6, `CLAUDE.md` |
| Calibration | Visitors' saved values must stay valid across changes; phones need the upright card. | `ppiCal`, `drawCal`, `setCal`, `scaleNote` |

## Tasks a second agent could take on without interfering

Each should be its own branch and pull request (`AGENTS.md`). Check first that no open pull request touches the same area.

Review only (no file changes, findings in a pull request comment or a report):

- Independent review of any open pull request.
- Share links and saved settings sanitizing: malformed, huge or hostile `#s=` links and `tss:` values (HTML in custom names, odd numbers, very long lists).
- Service worker update logic (`sw.js`): stale-copy risks, the 3-second race, behavior across versions, pdf.js cache handover.
- Crop white margins heuristics on real scans, books and slides (false crops, slow pages).
- `dprOf()` assumptions against current default scaling on popular devices.
- Accessibility beyond axe-core: screen reader flow, keyboard use of Free arrange, focus after redraws.
- Phone layout in real iOS Safari: sticky quick bar, touch drag and rotate, safe areas.
- Reference comparison numbers against hand calculations.
- Device data spot checks against makers' spec pages (report findings, don't edit the CSV without approval).
- `docs/` against the code, for accuracy.

Small, self-contained changes (one at a time, with Thomas's go-ahead):

- Add regression tests that only touch `tests/`, for example `parseCsv` edge cases (quoted commas, doubled quotes, blank and `#` lines) or more hostile share links.
- Check `docs/` and `methodology.html` against the code and fix wording that's out of date.

Ideas from earlier work (not commitments, need Thomas's go-ahead): add new devices as they ship (iPad 12th gen once released, 2027 phones); a search for "devices similar in size to X".

Needs a decision from Thomas before anyone starts:

- Moving `gen_csv.py` (the device list sorter, still only in Claude's project folder) into the repo, so every agent can sort `devices.csv` the same way.
- A shim for Safari 16.4–17.3 PDF support (only if such visitors appear).
- Any new device, CSV column, dependency or feature.
