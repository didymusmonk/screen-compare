# Device database contract

How True Size Screens stores and uses its device list, written so that researchers (ChatGPT, Gemini, Claude) and whoever integrates their results know what may change and what must not break.

Baseline: `device-audit/devices_original.csv`, an unchanged copy of `devices.csv` from `main` at commit `31bc528` (27 Nov 2026), SHA-256 `befed945f367b6c47d5425eb92b485a3df431f62506bbef752f278ec7918f8cb`. 315 rows: 285 screens and 30 paper, book and card sizes.

---

## 1. File format

`devices.csv` is plain UTF-8 CSV that the page downloads with `fetch()` and reads with its own parser (`parseCsv` in `index.html`).

```
# comment lines start with #
name,type,diagonal,width,height
iPad Pro 11-inch (M4/M5),tablet,11.1,2420,1668
"MacBook Air 13"" (M2 to M5)",laptop,13.6,2560,1664
US Letter paper,paper,,8.5,11
```

- Lines that are blank or start with `#` are skipped. The first remaining line is the header.
- Cells are comma separated. A cell containing a comma or a double quote is wrapped in double quotes, and a double quote inside is written twice (`13""` means `13"`).
- Spaces around a cell are trimmed.
- Columns are looked up by header name, so their order could change, but `tests/unit.js` requires the header to be exactly `name,type,diagonal,width,height`. Adding a column means changing that test and the loader together, so the research results use separate files (section 9) and nothing is added to `devices.csv` during research.

## 2. Fields

| Field | Meaning | Rules |
|---|---|---|
| `name` | What the visitor sees and searches. Also the source of the device's ID (section 3). | Unique, plain English. Brands are written as in the existing list (`Galaxy S25`, not `Samsung Galaxy S25`; `Lenovo Tab M11`, which does keep "Lenovo"). |
| `type` | Category. One of `phone`, `tablet`, `ereader`, `tablet pc`, `laptop`, `monitor`, `paper`. | The app shows them as Phones, Tablets, E-readers, Tablet PCs & 2-in-1s, Laptops, Monitors and Paper & books. Any other value makes the row vanish without an error. |
| `diagonal` | Screen diagonal in inches. Empty for paper. | A positive number. Shown to visitors exactly as written (`6.82″`), so use at most two decimals and no trailing zeros beyond what the maker publishes. `7` and `7.0` work the same. |
| `width`, `height` | Native pixel counts of the panel (screens), or inches (paper). | Whole numbers for screens. Order doesn't matter: the app always takes the larger as width. |

### What the app works out from these

`geom()` in `index.html` derives everything else. Nothing else about a device is stored.

```
hyp       = sqrt(width² + height²)          (pixels along the diagonal)
ppi       = hyp / diagonal
long side = diagonal × width  / hyp         (inches)
short side= diagonal × height / hyp         (inches)
```

So the physical outline depends only on the diagonal and the **ratio** of the pixel counts. A wrong pixel count changes the PPI, the shape and both side lengths; a wrong diagonal scales the whole outline. The outline is the active screen area only, never the bezel, and it is a plain rectangle: notches, punch holes and rounded corners are not drawn.

For paper, the app computes a diagonal from the inches only for search and labels. Paper has no PPI.

The pixel counts and PPI also feed the content previews: PDF fit, video letterboxing, e-book line counts and the website previews. The website previews also guess each device's display scaling from its name and PPI (`dprOf()`, section 6).

## 3. Identifiers

Every device is found by an **ID made from its name**, never by its row number:

```
slug(name) = lowercase → "+" becomes " plus " → every run of other characters becomes "-" → trim "-" at both ends
"Galaxy S26+"                    → galaxy-s26-plus
"iPad mini (A20 Pro, 2026)"      → ipad-mini-a20-pro-2026
"MacBook Air 13"" (M2 to M5)"    → macbook-air-13-m2-to-m5
```

These IDs are stored in:

- **Saved comparisons** (`localStorage` key `tss:state`, field `sel[].id`), kept on each visitor's device indefinitely.
- **Share links** (`#s=` followed by base64url JSON, field `sel[].i`). People have already posted these, and they can't be updated.
- **The paper menu** (`tss:state` `paper`), using paper IDs.
- **The first-visit default**: `ipad-mini-a20-pro-2026`, `ipad-pro-11-inch-m4-m5` and `us-letter-paper`.
- **Tests**, which name some devices and IDs directly (flag `USED_IN_TESTS` in the ledger).

When a saved or shared ID no longer matches any row, the app **quietly drops that screen** from the comparison. So:

- **Renaming a row changes its ID.** Changing a single character of punctuation can do it (`Surface Pro 7 / 7+` became `surface-pro-7-7-plus` when "+" started counting as "plus").
- Every old ID must be added to the `RENAMED` map in `index.html` (`old-id → new-id`). The app applies it to saved settings and share links when it loads. Paper uses a separate map, `OLD_PAPER_IDS`.
- `tests/unit.js` checks that no two names make the same ID, that no name appears twice, that every `RENAMED` target exists, and that no `RENAMED` key is also a current ID.
- Custom screens that visitors typed in themselves have their own IDs (`c-...`) and are unaffected by the CSV.

**`RENAMED` is a single hop.** It is applied once, to the saved or shared selection IDs, after the list loads; an old ID that points at another old ID is not followed further. So when a row that already has old IDs is renamed again, every existing key that points at its previous ID must be retargeted to the new ID, as well as adding the previous ID itself. Otherwise `tests/unit.js` fails ("renamed devices point to current IDs") and those older links stop working.

The 13 entries in `RENAMED` today (ledger flag `HAS_OLD_IDS` marks their targets):

| Old ID | Current ID |
|---|---|
| macbook-air-13-m2-m3-m4 | macbook-air-13-m2-to-m5 |
| macbook-air-15-m2-m3-m4 | macbook-air-15-m2-to-m5 |
| macbook-pro-16-m1-to-m4 | macbook-pro-16-m1-to-m5 |
| ipad-air-13-inch-m2-m3-m4 | ipad-air-13-inch-m2-to-m4 |
| ipad-air-11-inch-m2-m3-m4 | ipad-air-11-inch-m2-to-m4 |
| 15-6-portable-monitor-monitor | 15-6-portable-monitor |
| surface-book-1st-gen | surface-book-1st-gen-book-with-performance-base |
| surface-laptop-3-4-5-13-5 | surface-laptop-3-4-5-6-13-5 |
| surface-laptop-3-4-5-15 | surface-laptop-3-4-5-6-15 |
| surface-studio-2-studio-2 | surface-studio-2-plus-studio-2-studio |
| surface-studio-2-studio-2-studio | surface-studio-2-plus-studio-2-studio |
| galaxy-tab-s10 | galaxy-tab-s10-plus |
| surface-pro-7-7 | surface-pro-7-7-plus |

## 4. Grouping and naming conventions

- **One row per distinct screen, not per product.** Models with the same diagonal and pixel count may share a row, with every model in the name so search finds it: `Surface Laptop 3 / 4 / 5 / 6 (15")`, `iPad (7th/8th/9th gen)`, `MacBook Pro 14" (M1 to M5)`.
- **There are no hidden search aliases.** Search only matches the words of the name plus the category label (`renderResults()`), so a model missing from a grouped name can't be found. "Add a model to a group" is therefore a rename, with a new ID and a `RENAMED` entry.
- **Grouping is not applied consistently today.** For example, Galaxy Tab S8/S9/S10/S11 Ultra are four separate rows with the same screen, while `Galaxy Tab S8+ / S7+` is grouped; iPhone 16 Pro / 17 Pro / 18 Pro are separate. Separate rows are fine when visitors search for each model by name. Researchers should report grouping opportunities, not merge rows on their own initiative.
- **Foldables have one row per screen.** Book-style folds use `(inner)` and `(cover)`. Flip phones label only the cover (`Galaxy Z Flip7 (cover)`), and the inner screen row has no suffix. `iPhone Duo (front)` is the only `(front)`.
- **Dual-screen devices** (Surface Duo, Yoga Book 9i) are one row per screen, marked `(one screen)`.
- **Laptops sold with several panels** have one row naming one panel, sometimes with the panel in the name (`Framework Laptop 13 (2.8K)` and `(2.2K)`), usually without.
- **Generic classes** stand for a common kind of screen, not a product: `27" 4K monitor`, `Typical 14" Full HD laptop`. Their diagonal is the usual real viewable size (`24"` monitors are 23.8, `32"` are 31.5).
- **Diagonal convention:** the maker's published figure for the full rectangle of the active area, at the precision the maker gives. Apple publishes a "measured as a rectangle" figure alongside the marketing size, and the list uses it (`iPad Pro 11-inch (M4/M5)` is 11.1, `iPad Air 11-inch` 10.86, `MacBook Air 13"` 13.6). Samsung and others quote a full-rectangle figure and a smaller "rounded corners" figure; use the full rectangle. When the name's size differs from the diagonal, the ledger flags `NAME_SIZE_DIFFERS`; that is expected for these.
- **Unreleased and rumored devices are left out** (CLAUDE.md: "for example, the iPad 12th gen as of Nov 2026").
- **Sorting** (by `gen_csv.py`): Tablets, Phones, E-readers, Tablet PCs, Laptops, Monitors, Paper; then brand Apple, Samsung, Microsoft, Lenovo, Google, others, generic; families together, newest first. Row order does not affect IDs.

## 5. How devices.csv is produced

`devices.csv` is generated by `gen_csv.py` from `raw.json` in Thomas's Claude project folder (`/mnt/project-files/screen-compare/`), not edited by hand. Integration must update that source (or retire the generator deliberately) so a later regeneration doesn't undo the audit. `gen_csv.py` contains a hard-coded scratchpad path that must be adjusted each session.

## 6. Code that reads device names

Some behavior depends on the **wording of the name**, so a rename can change more than the ID (ledger flag `NAME_DRIVES_CODE`):

- `dprOf()` (website preview scaling):
  - Names starting `iPhone` get 3×, or 2× when the name has `SE` or `XR` as a word or ends in `11`.
  - Names starting `iPad` get 2×. `MacBook` gets PPI ÷ 127. `iMac`, `Apple Studio` and `Pro Display XDR` get 2×.
  - `Surface RT`, `Surface Laptop Go` and `Surface Laptop SE` get 1× and `Surface Studio` 2× (Microsoft's defaults). Other Surface devices fall through to the tablet PC rule, PPI ÷ 130, which gives 200% for 13-inch Surface Pros.
  - Other phones are based on a 412 px width, tablets and e-readers on PPI ÷ 160, monitors on PPI ÷ 110, and laptops and tablet PCs on PPI ÷ 130.
- `myScreenMatches()` ("Compare with my screen") looks for Apple names with `^(MacBook|iMac|Apple|Pro Display)`, and filters by category.
- Paper: the menu groups rows by whether the name contains "paper", or "card", "notebook" or "photo", and shows millimetres for names starting `A`/`B` digits or containing "manga".
- The first-visit default and several tests use specific IDs and names (section 3).

## 7. Backward compatibility rules for integration

1. Never reuse an ID for a different screen.
2. Any rename, regrouping, split or merge adds the old ID(s) to `RENAMED`. A split maps the old ID to the row most visitors meant (usually the newest or best-known model). A merge maps every old ID to the merged row.
3. Removing a row (for example a device found to be unreleased) either maps its ID to the nearest real device or accepts that it disappears from saved comparisons; this is decided case by case with Thomas.
4. Keep the three first-visit IDs working, or change `defaults()` in the same change.
5. Keep `README.md`'s count ("Search N built-in screens plus M paper...") in sync; a unit test checks it.
6. New rows must pass the unit test's PPI ranges: phone 200–600, tablet 120–400, e-reader 150–350, tablet PC 100–450, laptop 90–350, monitor 50–250, and shape at most 4:1. A real device outside them means the range needs widening in the same change, with a note.
7. Run `node tests/run-all.js` after integration. Update named devices in tests only where the device itself changed, and never weaken a check.
8. The audit folder stays off the live site: it lives only on the `device-database-audit` branch, nothing in the page references it, and the service worker doesn't cache it. If any of it is ever merged to `main`, GitHub Pages would make it reachable by URL but no visitor would download it; still, prefer to merge only the changed `devices.csv`, `index.html` (`RENAMED`), `README.md` and tests.

## 8. Orientation, categories, ordering and custom screens

**Orientation.** The CSV doesn't record orientation. The loader stores the larger pixel count as `w` and the smaller as `h` (paper too), so `2420,1668` and `1668,2420` are the same row. The whole stage is drawn portrait or landscape (`S.orient`), and each screen can be turned on its own (`flip` in saved settings, `f` in share links). Researchers should report resolution long side first and must not "correct" a row just because the maker lists it the other way round.

**Categories.** The `type` cell maps to the app's categories (`CATS` in `index.html`; `tablet pc` becomes the internal key `tabletpc`). The category chips and search results are always shown in the order Tablets, Phones, E-readers, Tablet PCs, Laptops, Monitors, Paper, then Your screens. Inside a category, results keep the CSV row order, which is why `gen_csv.py`'s sort (section 4) matters to visitors.

**Custom screens.** Visitors can type in their own screen (name, diagonal, and pixels or an aspect ratio). It's stored in their browser under `tss:custom` with an ID `c-<timestamp>` and category `custom`, and travels inside share links (`cu`), so the receiver sees it too. Aspect-ratio-only screens are marked `aspectOnly` and have no PPI. Custom screens never touch `devices.csv`, and the audit can't affect them, except that a custom name may duplicate a built-in name harmlessly.

**Saved settings are sanitized on load** (`isObj`, `okScreen`): malformed entries are dropped. Selections are capped at 12 screens.

## 9. Research results: the common intermediate files

These follow the master instructions' three files, with columns added for traceability and for this database's structure. Headers are in `templates/`, and every batch has a pre-filled `batches/<batch>_verification_results.csv` listing its original rows. Return files are named `<batch>_verification_results.csv`, `<batch>_missing_devices.csv` and `<batch>_unresolved_issues.csv` (for example `B03_missing_devices.csv`). `tools/check_results.py` validates them.

**Traceability.** Every original row has a permanent audit ID, `DEV-0001` to `DEV-0315`, in baseline order (`COVERAGE_LEDGER.csv` also gives its baseline line number, current app ID and a hash of the original row). `original_id` in the results is that audit ID, not the app's ID, because the app's ID changes whenever a name changes. Proposed new devices get `NEW-<batch>-<nn>` (for example `NEW-B10-03`). Issues get `ISS-<batch>-<nn>`. A `SPLIT` keeps one verification row and lists the proposed rows in `notes`; the extra rows also appear in `missing_devices.csv` with `existing_equivalent` naming the original `DEV-` ID.

### verification_results.csv (one row per original entry in the batch, never fewer)

| Column | Content |
|---|---|
| `original_id` | `DEV-####`, pre-filled. |
| `batch_id`, `researcher`, `pass` | Pre-filled; `pass` is `primary`, `second_pass` or `adjudication`. |
| `original_name`, `original_type`, `original_diagonal`, `original_width_px`, `original_height_px` | Pre-filled from the baseline. **Never edited.** |
| `manufacturer` | Brand as the maker writes it. |
| `verified_name` | The exact commercial name(s) the row should carry, only if different from the original (renames change the app ID). |
| `verified_category` | Only if the type should change. |
| `models_covered` | Every model with this exact screen, separated by ` \| `, including ones missing from the name. |
| `screen_role` | `single`, `inner`, `cover`, `one_of_two` (dual-screen device), `unfolded` (foldable PC). |
| `release_year` | Year the first covered model went on sale. |
| `nominal_diagonal` | Marketing size (e.g. 11 for "11-inch"). |
| `verified_diagonal` | The diagonal the app should use, at the source's precision (section 4: maker's full-rectangle figure). |
| `verified_width_px`, `verified_height_px` | Native panel resolution, long side first. For paper, inches. |
| `official_ppi` | PPI as the maker states it. Blank if not stated. |
| `color_ppi`, `color_width_px`, `color_height_px` | Color e-ink only. |
| `display_technology` | e.g. `OLED`, `IPS LCD`, `E Ink Carta 1300`, `E Ink Kaleido 3`, `E Ink Gallery 3`. |
| `active_width_mm`, `active_height_mm` | Only when a source documents the active area. Never calculated here. |
| `calculated_ppi` | √(w² + h²) ÷ `verified_diagonal`, one decimal. |
| `geometry_basis` | Where the diagonal comes from: `MAKER_DIAGONAL`, `MAKER_ACTIVE_AREA`, `PPI_IMPLIED`, `INDEPENDENT_MEASURED`, `STANDARD` (paper), `NOMINAL_ONLY`. |
| `panel_options` | Configurable devices: every panel sold, e.g. `14.0in 1920x1200 IPS; 14.0in 2880x1800 OLED (this row)`. |
| `verification_status` | `CONFIRMED`, `CORROBORATED`, `PARTIAL`, `ESTIMATED`, `RUMORED`, `UNVERIFIED` (master instructions, section 8). |
| `product_status` | `RELEASED`, `ANNOUNCED`, `RUMORED`, `DISCONTINUED`, `CANCELLED`, `UNKNOWN`. Kept separate from the verification status. |
| `primary_source_url`, `secondary_source_url` | Pages actually opened. One address per cell. |
| `evidence` | Short exact excerpt or spec-table label supporting the figures. |
| `verified_date` | `YYYY-MM-DD`. |
| `action` | `KEEP`, `CORRECT`, `SPLIT`, `MERGE`, `FLAG_FOR_REVIEW`. |
| `change_class` | `none`; `minor` (diagonal changes by less than 0.05 in, pixels, name and type unchanged); `material` (anything else, including any rename). |
| `second_pass_reasons` | Semicolon list of triggers from BATCH_MANIFEST.md section 4, or blank. |
| `notes` | Plain sentences. A `MERGE` names its target `DEV-` ID; a `SPLIT` lists the new rows. |

How the actions cover this database's cases: a rename or a model added to a group's name is `CORRECT` with `verified_name`; a wrong category is `CORRECT` with `verified_category`; a device that turns out to be unreleased is `FLAG_FOR_REVIEW` with `product_status` `RUMORED` or `ANNOUNCED`.

### missing_devices.csv

The master instructions' columns plus `new_id`, `batch_id`, `researcher`, `screen_role`, `color_width_px`, `color_height_px` and `calculated_ppi`. `existing_equivalent` gives the `DEV-` ID of a row with the same screen, or `none` after checking. A device whose screen matches an existing grouped row is still listed here, with that ID, because adding it means renaming the group. `inclusion_priority` is `essential`, `useful`, `optional`, or `review_queue` for anything announced but not shipping, or rumored: that's the separate review queue, and those devices are never added to the site.

### unresolved_issues.csv

The master instructions' columns plus `issue_id`, `batch_id`, `researcher`, `related_id` (`DEV-` or `NEW-`) and `field`. `issue_type` is one of `SOURCE_CONFLICT`, `PPI_MISMATCH`, `GEOMETRY_UNCERTAIN`, `GROUPING`, `NAMING`, `CATEGORY`, `RELEASE_STATUS`, `CONFIGURABLE_PANEL`, `COLOR_EINK`, `FOLDABLE`, `REGIONAL_VARIANT`, `POSSIBLE_DUPLICATE`, `SOURCE_UNAVAILABLE`, `OTHER`.

### Reconciled files for integration

After both passes and adjudication, the batch files are reconciled into four files, which the integration review checks. Headers are in `templates/`. `COVERAGE_LEDGER.csv` records each original row's final disposition.

**`devices_verified.csv`**: one row per row the site would have after integration.

| Column | Content |
|---|---|
| `audit_id` | `DEV-####` for a kept or corrected original row; `NEW-B##-##` for an addition. A split keeps the `DEV-` ID on the row its old app ID maps to, and the other parts use their `NEW-` IDs. |
| `name`, `type`, `diagonal`, `width`, `height` | Exactly as they would go into `devices.csv` (sections 1–2). |
| `source_url`, `reported_ppi`, `color_ppi`, `status`, `geometry_note` | The optional columns proposed in section 10. All single-line. |

**`device_changes.csv`**: one row per change to one field.

| Column | Content |
|---|---|
| `change_id` | `CHG-####`. |
| `audit_id` | `DEV-` or `NEW-` ID. |
| `change_type` | `KEEP`, `CORRECT`, `RENAME`, `SPLIT`, `MERGE`, `ADD`, `REMOVE`, `FLAG`. |
| `field` | `name`, `type`, `diagonal`, `width`, `height`, or an optional column; blank for `KEEP`, `ADD`, `REMOVE` and `FLAG`. |
| `old_value`, `new_value` | Values before and after. |
| `old_app_id`, `new_app_id` | `slug(name)` before and after. |
| `needs_renamed_entry` | `YES` when the app ID changes, a row is merged, or a row is split. Otherwise `NO`. |
| `change_class` | `none`, `minor`, `material` (section 9). |
| `source_url`, `evidence` | The deciding source and its excerpt. |
| `approved` | Left blank, for Thomas. |
| `notes` | Plain sentences. |

**`missing_devices_verified.csv`** has the `missing_devices.csv` columns, adjudicated. **`unresolved_issues.csv`** has the same columns as the batch files, merged.

Rules:
- Every `DEV-` ID appears at least once in `device_changes.csv` (`KEEP` counts).
- Every `DEV-` ID appears in `devices_verified.csv` unless it was merged or removed.
- Every `NEW-` ID in `devices_verified.csv` has an `ADD` or `SPLIT` row in `device_changes.csv`.

## 10. Recommended optional fields for devices.csv (integration stage, not now)

If integration adds fields, add them as **extra columns after the existing five**, read by header name, so older copies of the page (and the offline copy in visitors' service worker caches) keep working: the current loader ignores columns it doesn't know. `tests/unit.js`'s exact-header check would need to accept the longer header.

| Column | Purpose | Notes |
|---|---|---|
| `source_url` | Maker's spec page, for an unobtrusive link on the card | One URL; https only; shown with `rel="noopener"`, escaped with `esc()`. |
| `reported_ppi` | Maker's PPI when it differs slightly from the calculated one | Display only; the drawing keeps using diagonal and pixels. |
| `color_ppi` | Color e-ink only | Blank for everything else. |
| `status` | Blank for confirmed; `estimated` or `partial` otherwise | Lets the card mark uncertain figures. Rumored devices aren't listed at all. |
| `geometry_note` | Short note such as "inner screen, unfolded" or "OLED version" | Optional. |
| `audit_id` | The `DEV-`/`NEW-` ID | Keeps the research traceable after integration; not shown. |

`parseCsv` reads the file line by line, so a quoted cell can't contain a line break. Every text field (`geometry_note`, names, URLs) must be a single line.

Each extra column adds bytes to every visit (the CSV is fetched fresh each time), so URLs should be the shortest stable form. About 315 URLs of 60 characters each would add roughly 19 KB uncompressed, about 5 KB compressed.

## 11. Known structural issues for researchers

1. **Grouped rows** (flag `GROUP`): verify every model named, not just the newest, and list any model that has the same screen but is missing from the name. If one named model differs (a different diagonal or resolution), propose `SPLIT`.
2. **Foldables** (`FOLD_INNER`, `FOLD_COVER`, `FOLDABLE_PC`): the inner and cover screens are separate rows and must be verified separately. Makers often quote the inner diagonal unfolded and including the crease, and inner panels are close to square, so check the pixel orientation carefully. Flip-phone inner rows have no `(inner)` label.
3. **Configurable laptops and 2-in-1s** (`CONFIGURABLE`): report every panel the model is sold with in `panel_options`, and say which one the row matches. Suggest a split only when two panels are common, and say whether the panel belongs in the name.
4. **Rumored or post-mid-2026 devices** (`RELEASE_CHECK`): Claude's own knowledge ends around mid-2026, so these rows (iPhone Duo, iPhone 18 Pro, Galaxy Z Fold8/Flip8, Pixel 11 Pro Fold, MacBook Neo, Kindle 2026 models and others) need proof that the device was officially announced and is on sale, from the maker. Rumor sites, leaks and concept renders don't count. A device that isn't released gets `FLAG_FOR_REVIEW` with `product_status` `RUMORED` or `ANNOUNCED`, and the rest of its row is still filled in from whatever official information exists.
5. **Color e-ink** (`COLOR_EINK`): Kaleido and Colorsoft panels have a monochrome resolution (usually 300 ppi) and a lower color resolution (usually 150 ppi). The CSV keeps the **monochrome (full panel) resolution**, because that's what text is drawn at; record the color resolution in `color_width_px`/`color_height_px`. Some rows group a monochrome and a color model (`Kindle Scribe 3 / Scribe Colorsoft`, `Boox Go 7 / Go Color 7`).
6. **Apple diagonals** (`APPLE_DIAGONAL`, `NAME_SIZE_DIFFERS`): use Apple's measured-as-a-rectangle figure from the Tech Specs footnotes, not the marketing size. iPhone diagonals are rounded to one decimal by Apple; keep Apple's figure.
7. **Generic classes** (`GENERIC_CLASS`): check that the class is a real common configuration and the diagonal is the usual viewable size; cite two current products of that class instead of one maker's spec page.
8. **Phones in Tablet PCs**: Surface Duo and Duo 2 are filed under `tablet pc`; flag whether that should change rather than changing it.
9. **Identical screens** (`SAME_SCREEN`): two rows with the same figures are not errors by themselves, but check each against its own sources rather than copying.
10. **Regional variants**: if the same model name has different screens in different regions, add an `unresolved_issues.csv` row (`REGIONAL_VARIANT`) rather than picking one silently.

## 12. Code issues noticed while preparing (not fixed in this branch)

- `myScreenMatches()` filters touch devices with `d.c === "tablet pc"`, but the loader stores that category as `tabletpc`. So "Compare with my screen" on a Surface Pro or other touch 2-in-1 never offers a tablet PC match. It's a one-word fix, left for a separate change since this task must not change the app.
- `Kobo Libra Colour` writes its diagonal as `7` rather than `7.0`; harmless.
