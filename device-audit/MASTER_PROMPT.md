# True Size Screens: master research and verification prompt

Give this whole file to every model (ChatGPT, Gemini, Claude) together with `DATABASE_CONTRACT.md`, `BATCH_MANIFEST.md` and the batch file it's working on.

- **Part A** is Thomas's master instructions, with the wording unchanged.
- **Part B** applies them to this database: files, IDs, columns and rules that make results from different models mergeable.
- **Part C** has the role cards.

Where Part B is more specific than Part A, follow Part B. It was written after inspecting the real database and only adapts the file layout, as Part A section 9 allows.

---

# Part A. Master instructions (from Thomas; wording unchanged, headings moved down one level)

## True Size Screens — Collaborative Device Database Verification Project

### Project context

True Size Screens is a lightweight, open-source website for comparing physical display dimensions and simulating how pages, PDFs, ebooks, videos and websites appear on different screens.

Repository:
https://github.com/didymusmonk/screen-compare

The application currently contains approximately 285 or more device entries. Its accuracy depends on reliable display specifications.

This project will use ChatGPT Plus, Gemini Pro and Claude Pro collaboratively. Each model will receive a designated research, verification or implementation role.

The objective is not to maximize the number of entries indiscriminately, but to create a trustworthy, reasonably comprehensive, traceable and maintainable database of relevant display devices.

### 1. Core objectives

- Verify every existing device entry against reliable specifications.
- Correct inaccurate diagonals, native resolutions and pixel densities.
- Identify missing devices that would be useful additions.
- Distinguish confirmed specifications from estimates and rumors.
- Establish traceable sources for display specifications.
- Preserve compatibility with the existing website and saved comparisons.

### 2. Research principles

Prioritize sources in this order:

1. Official manufacturer technical specification pages.
2. Official product documentation, manuals and datasheets.
3. Official manufacturer announcements and archived specification pages.
4. Reliable independent technical reviews or measured display specifications.
5. Reputable device databases when primary sources are unavailable.
6. Retailer listings only when better sources cannot be located.

Actually open and inspect cited sources. Do not rely solely on search-result snippets or generated summaries.

Never invent a specification, source URL, quotation or verification result.

Distinguish specifications directly supported by a source from values calculated or inferred from those specifications.

Agreement between multiple AI models does not constitute independent evidence.

If reliable information is unavailable, retain the existing specification provisionally and flag it for review rather than guessing.

Record the date of verification and whether a product is released, officially announced, rumored or discontinued.

### 3. Specifications to verify

For each device, investigate:

- Manufacturer.
- Exact commercial model name.
- Model generation or release year.
- Display category.
- Nominal diagonal.
- More precise active display diagonal, if documented.
- Native horizontal and vertical pixel resolution.
- Manufacturer-reported monochrome or standard PPI.
- Color PPI, where applicable.
- Physical active display width and height, where documented.
- Aspect ratio.
- Relevant unusual display characteristics.
- Official or otherwise reliable specification source URL.

Do not confuse screen dimensions with overall device dimensions.

Do not confuse native resolution with logical resolution, scaled resolution, CSS viewport dimensions or video output resolution.

### 4. Physical geometry and numerical consistency

Independently calculate:

- PPI from native resolution and physical diagonal.
- Physical width and height from the chosen diagonal and pixel aspect ratio.
- Display area.
- Diagonal implied by manufacturer-reported PPI.

Investigate significant discrepancies between documented and calculated values.

Recognize that advertised diagonals and manufacturer-reported PPI may both be rounded.

Do not automatically assume that one is always more precise than the other.

Prefer directly documented active display dimensions when available and reliable.

Use the most reliable available evidence to establish the physical geometry used by the application.

Keep original source values distinguishable from derived values.

Do not silently manufacture precision by reporting excessive decimal places.

Flag unusual pixel aspect ratios rather than assuming square pixels without investigation.

### 5. Special display categories

#### Foldable devices

Distinguish internal folding displays from external cover displays.

Verify each screen separately.

Distinguish different regional models or generations where their displays differ.

Do not treat a folding device's advertised combined size as a separate display unless the manufacturer documents it as such.

#### Color e-ink

Distinguish monochrome resolution and PPI from effective color resolution and PPI.

Identify whether a color display uses Kaleido, Gallery or another technology where this affects interpretation of resolution.

Use the appropriate monochrome resolution for black-and-white text comparisons.

Do not assume all color e-ink technologies have the same relationship between monochrome and color resolution.

#### Rounded and interrupted displays

Use full rectangular display dimensions where that is the manufacturer's specification convention.

Document relevant differences between full rectangular and actual visible display area where reliably available.

#### Grouped devices

Verify that models grouped in a single database entry genuinely have identical relevant display geometry and resolution.

Separate grouped models when their display specifications differ.

Preserve existing identifiers and aliases where possible to avoid breaking shared comparisons.

#### Regional and configurable variants

Identify regional, optional and configurable displays.

Do not assume that all laptops sold under the same model name have identical screens.

Represent distinct display options separately when their physical dimensions or native resolutions differ meaningfully.

Avoid unnecessary duplication of models with identical relevant display specifications.

### 6. Missing-device discovery

Systematically review the existing database against relevant manufacturer product lineups.

Identify omissions in:

- Current flagship devices.
- Mainstream devices.
- Recent previous generations.
- Popular older devices still in use.
- Devices commonly compared by potential purchasers.
- Distinctive screen sizes or aspect ratios.
- Important e-ink devices.
- Foldable internal and external screens.
- Significant laptop and tablet display configurations.

Prioritize additions by usefulness to the website's purpose, not merely by release date.

Apple devices, tablets and e-readers are especially important because many visitors use iPhones and iPads and compare devices for reading.

Do not restrict discovery to Apple products.

Investigate major relevant manufacturers, including Apple, Samsung, Google, Microsoft, Amazon, Kobo, Onyx BOOX, reMarkable, Lenovo, ASUS, Dell, HP, LG, Huawei, Honor, Xiaomi, Oppo, OnePlus, Vivo, Motorola, PocketBook, Bigme, Supernote and other manufacturers where relevant.

Search for important missing manufacturers as well as missing devices from known manufacturers.

Treat this manufacturer list as a starting point, not an exhaustive list.

Do not add rumored products to the confirmed-device list.

Place unconfirmed future devices in a separate review queue.

### 7. Proposed additions and duplication control

For every proposed new device, identify:

- Exact model and display variant.
- Release year and product status.
- Whether it duplicates an existing entry under another name.
- Whether its display matches an existing grouped entry.
- Relevant display specifications.
- Supporting source URLs.
- Reason for inclusion.
- Inclusion priority: essential, useful or optional.

Preserve the application's existing approach to grouping equivalent displays where appropriate.

Do not add every regional rebranding or minor product variant unless it offers meaningful comparison value.

### 8. Verification status

Use the following specification statuses:

- CONFIRMED: Core specifications verified against a reliable primary source.
- CORROBORATED: Core specifications verified against reliable independent secondary evidence when primary documentation is unavailable.
- PARTIAL: Some specifications are verified, but others remain uncertain.
- ESTIMATED: One or more important specifications are inferred or approximate.
- RUMORED: Product or specifications are not officially established.
- UNVERIFIED: Existing database entry has not yet been adequately researched.

Record product lifecycle status separately from specification verification status.

A discontinued device can have fully confirmed specifications.

### 9. Required research outputs

Preserve the original devices.csv unchanged during research.

Produce machine-readable UTF-8 CSV files rather than only prose reports.

Use the following intermediate files:

#### verification_results.csv

One row for every existing entry assigned to the research batch.

Suggested columns:

original_id, original_name, manufacturer, verified_name, original_diagonal, original_width_px, original_height_px, nominal_diagonal, verified_diagonal, verified_width_px, verified_height_px, official_ppi, color_ppi, active_width_mm, active_height_mm, calculated_ppi, geometry_basis, verification_status, product_status, primary_source_url, secondary_source_url, evidence, verified_date, action, notes

Permitted actions:

KEEP, CORRECT, SPLIT, MERGE, FLAG_FOR_REVIEW

Adapt the intermediate schema if necessary after inspecting the original database, but retain traceability to every original row.

#### missing_devices.csv

Suggested columns:

manufacturer, device_name, display_variant, release_year, category, nominal_diagonal, verified_diagonal, width_px, height_px, official_ppi, color_ppi, active_width_mm, active_height_mm, verification_status, product_status, primary_source_url, secondary_source_url, evidence, inclusion_priority, existing_equivalent, reason_for_inclusion, notes

#### unresolved_issues.csv

Suggested columns:

device_name, issue_type, existing_value, candidate_value, conflicting_sources, explanation, suggested_next_step

Include meaningful source evidence, such as a short specification excerpt, specification table label or documented measurement.

Leave unsupported optional fields blank rather than inventing values.

### 10. Research workflow

Work in category-based batches of approximately 20–40 existing entries, allowing related device families to remain together.

Complete each batch before moving to the next.

Research related product lineups while verifying existing devices so that missing generations can be identified efficiently.

At the end of each batch, provide:

- Number of original entries processed.
- Number confirmed or corroborated.
- Number corrected.
- Number still uncertain.
- Number of grouped entries requiring changes.
- Number of proposed new devices.
- Output files.
- Outstanding research questions.

Maintain a coverage ledger so that no original entries are silently skipped.

If tool or usage limits prevent completion, report exactly where work stopped and provide the completed results.

### 11. Independent verification

Automatically flag entries for a second research pass when:

- Primary sources disagree.
- Manufacturer-reported PPI differs significantly from calculated PPI.
- Physical display dimensions are uncertain.
- A previously recorded specification is being materially changed.
- A product is rumored or only partially documented.
- A foldable or color e-ink display has unusual specifications.
- A proposed new device may duplicate an existing entry.
- A cited source cannot be opened or does not support the claim.

The second model should independently examine the underlying evidence rather than merely endorse the first model's conclusions.

Use a random stratified sample of ordinary confirmed entries for additional quality control.

Resolve disagreements by examining source quality and documented evidence, not by majority vote among AI models.

### 12. Implementation constraints

Research and verification do not authorize changes to the production website.

Do not overwrite devices.csv, modify production code, change stable device identifiers or deploy updates during the research phase.

The final verified database must undergo a separate integration and regression-testing phase.

Preserve the existing website's simplicity, visual design, performance, offline functionality and backward compatibility.

Do not introduce general device specifications unrelated to the website's purpose.

Follow the role-specific instructions provided separately.

---

# Part B. How to apply this to the True Size Screens database

## B1. What you receive for each batch

| File | What it is |
|---|---|
| `MASTER_PROMPT.md` | This file. |
| `DATABASE_CONTRACT.md` | How the database works. Read sections 2–4, 9 and 11 before starting. |
| `BATCH_MANIFEST.md` | All batches, who does what, the flag legend and the second-pass rules. Find your batch there. |
| `batches/<batch>_verification_results.csv` | Your batch's original rows, pre-filled. This is the file you fill in and return. |
| `COVERAGE_LEDGER.csv` | Every original row with its audit ID, batch, structure flags and preparation notes. Use it to look up flags and notes for your rows, and to check whether a "missing" device is already in the list under another name. |

You don't need the repository or the website. The ledger already contains every original row.

## B2. Identifiers (the most important rule)

- Every original row has a permanent **audit ID** `DEV-0001` … `DEV-0315`. It is pre-filled in `original_id`. Never change, renumber, merge or drop these rows. **Return exactly one verification row for every row in your batch file**, in the same order, even if you couldn't research it (then: `verification_status` `UNVERIFIED`, `action` `FLAG_FOR_REVIEW`, and say why in `notes`).
- Never edit the pre-filled `original_*` cells, even if they are wrong. Put the right values in the `verified_*` columns.
- New devices get `NEW-<batch>-<nn>` in `missing_devices.csv`, numbered from 01 in your batch (for example `NEW-B07-01`).
- Issues get `ISS-<batch>-<nn>` in `unresolved_issues.csv`. Use `related_id` to point to the `DEV-` or `NEW-` row.
- The website's own device ID is made from the name, so **any change of name breaks saved comparisons unless handled at integration**. Only propose a new name when the current one is wrong or incomplete; never for style.

## B3. Columns

Use the exact headers in the batch file and in `templates/missing_devices_header.csv` and `templates/unresolved_issues_header.csv`, in the same order. They are Part A's suggested columns plus a few needed for this database. `DATABASE_CONTRACT.md` section 9 explains every column. The short version:

- **Resolution:** long side first, native panel pixels.
- **Diagonal:** the maker's full-rectangle figure at the precision the maker gives (Apple: the "measured as a standard rectangle" figure in the Tech Specs footnotes). Put the marketing size in `nominal_diagonal`.
- **`calculated_ppi`:** √(width² + height²) ÷ `verified_diagonal`, one decimal. If `official_ppi` differs from it by more than 2%, add `PPI_MISMATCH` to `second_pass_reasons` and explain in `notes`. Also compute the diagonal the official PPI implies (√(w² + h²) ÷ official PPI) and mention it there.
- **`active_width_mm`, `active_height_mm`:** only when a source documents them. Leave them blank otherwise. Never fill them from your own calculation.
- **`geometry_basis`:** `MAKER_DIAGONAL`, `MAKER_ACTIVE_AREA`, `PPI_IMPLIED`, `INDEPENDENT_MEASURED`, `STANDARD` or `NOMINAL_ONLY`.
- **`models_covered`:** every model that shares this exact screen, separated by ` | `, including ones missing from the current name.
- **`screen_role`:** `single`, `inner`, `cover`, `one_of_two` or `unfolded`.
- **Color e-ink:** keep the monochrome resolution in `verified_width_px`/`verified_height_px` and put the color layer in `color_width_px`, `color_height_px` and `color_ppi`. Name the panel in `display_technology` (Kaleido 3, Gallery 3, Colorsoft, …).
- **Configurable devices:** list every panel in `panel_options` and mark which one the row matches.
- **`verification_status`:** use Part A section 8. `CONFIRMED` needs a manufacturer source in `primary_source_url`. `CORROBORATED` means no manufacturer page could be found but independent evidence agrees.
- **`product_status`:** `RELEASED`, `ANNOUNCED`, `RUMORED`, `DISCONTINUED`, `CANCELLED` or `UNKNOWN`.
- **`action`:**
  - `KEEP`: every figure and the name are right.
  - `CORRECT`: a figure, the name or the category is wrong. Fill only the `verified_*` cells that change, plus the confirmed ones.
  - `SPLIT`: grouped models' screens differ. List the proposed rows in `notes` and add each one to `missing_devices.csv` with `existing_equivalent` set to the original `DEV-` ID.
  - `MERGE`: this row should join another with an identical screen. Name the target `DEV-` ID in `notes`.
  - `FLAG_FOR_REVIEW`: not settled, rumored, unreleased or sources conflict. Add an `unresolved_issues.csv` row.
- **`change_class`:** `none`; `minor` (the diagonal changes by less than 0.05 in, and the pixels, name and category don't change); `material` (anything else, including any rename).
- **`second_pass_reasons`:** semicolon list from `BATCH_MANIFEST.md` section 4, for example `material change; foldable`.
- **Dates:** `YYYY-MM-DD`. **Numbers:** plain digits, no units, no thousands separators, no `~`. **Blank** means unknown.
- **URLs:** one per cell. Use the page you actually opened and read. If a manufacturer page has moved, an archived copy (web.archive.org) is fine and counts as the manufacturer source; say so in `notes`.
- **`evidence`:** a short exact excerpt, under 200 characters, such as `Display: 6.3-inch (diagonal) all-screen OLED display; 2622-by-1206-pixel resolution at 460 ppi`.

## B4. What counts as a source

- **Good:** the maker's tech-spec pages, support/spec pages, manuals, press releases, regulatory filings, and the panel maker's datasheet.
- **Acceptable secondary:** measured reviews (Notebookcheck, DisplayMate, RTINGS, AnandTech archives), and established spec databases (GSMArena, PhoneArena, Panelook, DisplaySpecifications) when cross-checked.
- **Not a source:** another AI's answer, Wikipedia alone (follow its citation instead), rumor or leak sites for anything claimed as released, aggregator pages without their own sourcing, search snippets, and your own memory.
- If you can't open a page (paywall, region block, robot check), don't cite it as checked. Write `SOURCE_UNAVAILABLE` in an issue row instead.

## B5. Missing devices

Look at the whole lineup for the families in your batch, and at the extra manufacturers and families listed for your batch in `BATCH_MANIFEST.md`. For each candidate:

1. Search `COVERAGE_LEDGER.csv` for it (including inside grouped names such as `Surface Laptop 3 / 4 / 5 / 6`).
2. Check whether an existing row has the **identical** diagonal and pixels. If it does, still list it, with `existing_equivalent` naming that `DEV-` ID: it will be added to that group's name, not as a new row.
3. Only devices that have actually gone on sale get `essential`, `useful` or `optional`. Announced-but-not-shipping or rumored devices get `inclusion_priority` `review_queue`, `verification_status` `RUMORED` (or `PARTIAL` if officially announced), and are never added to the site.
4. Aim for quality. As a guide, about 5–25 well-sourced additions per batch, with the most useful first.

Rough priorities:
- **essential:** current or last-two-generation flagships and best-sellers, or a distinctive screen size visitors are likely to look for.
- **useful:** popular older models still widely used, mainstream mid-range models, and common laptop panel options.
- **optional:** niche models, regional models, near-duplicates.

## B6. How to work

1. Read the flags and notes for your rows in `COVERAGE_LEDGER.csv`. `BATCH_MANIFEST.md` section 5 explains each flag.
2. Work through the rows in order. For long batches, do them in chunks of about 10–15 rows and show each chunk's rows before moving on, so nothing is skipped.
3. Then do the missing-device sweep for the batch.
4. Return **three CSV files** as downloadable files (or, if the tool can't make files, as three separate code blocks with nothing else inside them): `<batch>_verification_results.csv`, `<batch>_missing_devices.csv` and `<batch>_unresolved_issues.csv`. A file with no rows still has its header line.
5. End with the batch summary from Part A section 10.
6. If you run out of time or usage, return what's finished. Mark unfinished rows `UNVERIFIED` / `FLAG_FOR_REVIEW` with `notes` `not reached`, and say exactly where you stopped.

## B7. Do not

- Don't change or reorder the pre-filled rows, and don't add columns.
- Don't round the maker's figures, or add decimals they didn't publish.
- Don't fill a cell with a guess. Blank is better.
- Don't treat another model's answer as evidence.
- Don't propose changes to the website itself. Report ideas in `notes` instead.

---

# Part C. Role cards

Paste the right card as the first message of each chat, after attaching the files. Thomas may replace these with his own role instructions; if so, his take priority.

## C1. Primary researcher (ChatGPT for B01–B06, Gemini for B07–B11)

> ROLE: PRIMARY RESEARCHER for True Size Screens, batch `<B..>`.
> Follow MASTER_PROMPT.md (Parts A and B) and DATABASE_CONTRACT.md exactly. Your batch file is `<B..>_verification_results.csv`; the batch's scope, extra manufacturers to sweep, and flag meanings are in BATCH_MANIFEST.md. Use web browsing and open every page you cite. Return the three CSV files and the batch summary. Today's date is `<date>`.

## C2. Second-pass verifier (the other model)

> ROLE: SECOND-PASS VERIFIER for True Size Screens, batch `<B..>`-SP.
> Follow MASTER_PROMPT.md (Parts A and B) and DATABASE_CONTRACT.md. The attached `<B..>_SP_verification_results.csv` lists rows chosen for independent verification, and `<B..>_SP_new_devices_to_check.csv` lists proposed new devices by name only: research their specs and return them in a missing_devices file keeping the same new_id. It shows only the original database values, not another researcher's conclusions. Research each row from scratch, as if no one had looked at it. Open and read every source. For each row, fill the same verification columns with `pass` set to `second_pass`. Return `<B..>_SP_verification_results.csv`, `<B..>_SP_missing_devices.csv` and `<B..>_SP_unresolved_issues.csv` and a summary. For grouped rows, check every model and every display option sold under the name. Quote the source's own words in `evidence`. Don't try to guess what an earlier researcher concluded.

## C3. Adjudicator and integrator (Claude)

Claude receives both passes, compares them field by field, and for every disagreement, material change, new device and unresolved issue opens the cited sources itself, deciding on source quality, never on which model said what. It records each original row's final disposition in `COVERAGE_LEDGER.csv`, produces the reconciled files listed in `DATABASE_CONTRACT.md` section 9, and only then prepares an integration proposal for Thomas's approval.
