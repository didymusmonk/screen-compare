# Batch manifest

> **Superseded on 27 Nov 2026** by the simplified workflow in `README.md` and `GEMINI_PROMPT.md` (one Gemini pass, script checks, Claude reviews exceptions only, no second pass). Kept for the record and for the flag legend.

The 315 original rows of `devices_original.csv` are divided into 12 category-based batches. Every row is in exactly one batch; `COVERAGE_LEDGER.csv` names the batch for each audit ID, and `batches/<batch>_verification_results.csv` lists each batch's rows, pre-filled.

## 1. Batches

| Batch | Scope | Rows | Primary | Main structural issues | Extra discovery sweep |
|---|---|---:|---|---|---|
| **B01** | iPhone (all, except the foldable) | 37 | ChatGPT | 3 release checks (iPhone 18 Pro, 18 Pro Max, 17e); Apple's rounded-corner diagonals; many identical screens across generations | Missing older models still in use (iPhone 7/6s/6, SE grouping), iPhone 17 family completeness |
| **B02** | iPad, Mac and Apple displays | 27 | ChatGPT | 18 grouped rows; Apple's measured diagonals; 7 release checks (iPad mini A20 Pro, iPad Air M4, MacBook Neo, MacBook Air M5, MacBook Pro 16 M5); both first-visit default iPads | Missing group members (Intel MacBook Air/Pro with identical screens, M1 MacBook Pro 13"), older iPad Pro 12.9 and iPad mini, iMac/Studio Display variants, MacBook 12" |
| **B03** | Microsoft Surface (tablet PCs, laptops, Studio, Duo) | 32 | ChatGPT | 13 grouped rows, 5 with old IDs; Surface Duo filed as tablet PC; OLED and LCD Surface Pro 11 | Any Surface released since mid-2025; complete Go, Laptop Go and Pro X histories; business-only variants only if their screen differs |
| **B04** | Other Windows 2-in-1s and laptops (Lenovo, Dell, HP, ASUS, Framework) | 21 | ChatGPT | Every row is a configurable model; 4 release checks (ThinkPad Gen 14/8/6/5); foldable PC; dual-screen Yoga Book | Best-selling models with distinctive panels: Dell XPS 13 (9345) and successors, HP EliteBook/Spectre, ASUS Zenbook Duo, Lenovo Yoga Slim, Chromebooks (real models), LG gram, Acer Swift, Razer Blade. Prefer common panels over every SKU |
| **B05** | Kindle, Kobo, reMarkable and other non-Boox e-readers | 14 | ChatGPT | 7 grouped rows; color e-ink (Colorsoft, Libra Colour); mono + color in one group (Scribe 3 / Scribe Colorsoft); 4 release checks (2026 Kindles) | Kobo (Clara BW, Clara Colour, Libra 2, Sage, Elipsa), reMarkable Paper Pro Move, PocketBook, Supernote, Bigme, Tolino, Kindle Oasis/Paperwhite Signature names |
| **B06** | Generic monitors and typical laptops | 21 | ChatGPT | Generic classes, not products: check the usual viewable diagonal (23.8, 31.5, 37.5, 39.7, 44.5) and resolution with two current example products each | Common classes missing: 24" WUXGA 1920 x 1200, 27" 5K generic, 32" 5K/6K, 16:10 laptop panels, 13.3" Full HD laptop |
| **B07** | Samsung Galaxy phones, not foldable (S, Note, A) | 31 | Gemini | 1 release check (S26 FE); full-rectangle vs rounded-corner diagonals; many identical screens | Galaxy S20 series, A-series current models (A17/A26/A36/A57 and so on), M/F series only if popular |
| **B08** | Samsung foldable phones | 21 | Gemini | 8 release checks (TriFold, Fold8, Fold8 Ultra, Flip8); flip inner rows lack `(inner)`; Flip4 cover differs from Flip5/6/7 FE | Galaxy Z Fold/Flip generations missing (Fold 1/2, Flip 1/3), Fold SE / special editions |
| **B09** | Google, OnePlus, Oppo and Xiaomi phones, plus Apple's foldable | 23 | Gemini | iPhone Duo (release check, `(front)` label); Pixel 11 Pro Fold (release check); Xiaomi 17 Ultra, Redmi Note 15, POCO F9 Ultra (release checks); identical Pixel Fold inner screens | **Largest gap.** Pixel 10, 10 Pro, 10a, Pixel 8/8 Pro/8a, Pixel 7 family; Motorola (Razr inner + cover, Edge, Moto G); OnePlus 12/15, Nord; Xiaomi 15 family; Huawei Mate X / Pura; Honor Magic V; Vivo X Fold; Nothing Phone; Sony Xperia |
| **B10** | Android tablets (Samsung, Lenovo, Google, Amazon, OnePlus) | 36 | Gemini | Inconsistent grouping (four identical Tab Ultra rows separate, S8+/S7+ grouped); 1 release check (Legion Tab) | Galaxy Tab S10 Lite, S9/S10 FE variants, Tab A11; Amazon Fire HD 10 newer gens, Fire Max; Xiaomi Pad / Redmi Pad; OnePlus Pad 3 / Pad Go; Huawei MatePad; Honor Pad |
| **B11** | Boox e-readers | 22 | Gemini | 10 color rows (Kaleido 3 vs Gallery 3); 9 release checks; four identical Note Air C rows; unfamiliar names (Picco) | Boox Note Air 4/5 monochrome, Tab Ultra C, Poke, Leaf, Page; Boox models sold under other names |
| **B12** | Paper, book and card sizes | 30 | Claude | Not devices: checked against published standards (ISO 216, JIS P 0138, ANSI, ISO/IEC 7810 ID-1, trade book trims). 12 rows with old paper IDs; the credit card must match the app's calibration card (85.60 x 53.98 mm) | None needed |

Totals: ChatGPT 152 rows (B01–B06), Gemini 133 rows (B07–B11), Claude 30 rows (B12). Gemini's batches carry most of the discovery work (non-Samsung Android phones and tablets have the biggest gaps), which roughly evens out the workload.

**Why this split.** Each batch keeps related families together (the whole iPhone line, all Samsung foldables, all Boox) so a researcher sees a lineup once and spots both errors and gaps. ChatGPT takes Apple, Microsoft, Windows PCs, Amazon/Kobo/reMarkable e-readers and generic classes. Gemini takes the Android ecosystem (Samsung, Google, Chinese brands) and Boox. Neither split is about one model being "better" at a brand; it simply keeps each lineup in one pair of hands. Paper sizes are fixed standards and need no web research.

**Suggested order** (Thomas's priority is Apple devices, tablets and e-readers):
- ChatGPT: B02, then B01, B05, B03, B04, B06.
- Gemini: B10, then B11, B09, B08, B07.
- Run the two in parallel.

## 2. Workflow for every batch

1. **Primary pass.** The primary model gets `MASTER_PROMPT.md`, `DATABASE_CONTRACT.md`, `BATCH_MANIFEST.md`, `COVERAGE_LEDGER.csv` and the batch file. It returns `<batch>_verification_results.csv`, `<batch>_missing_devices.csv` and `<batch>_unresolved_issues.csv`, plus its summary.
2. **Check the files.** Claude saves them under `device-audit/results/<batch>/primary/` and runs `python3 device-audit/tools/check_results.py --coverage`. A file with errors goes back to the same chat with the error list.
3. **Pick second-pass rows** (section 4). Claude builds `<batch>_SP_verification_results.csv` with only the original values, never the first answer.
4. **Second pass.** The other model researches those rows from scratch, plus every proposed new device (given as name and model only, without the first researcher's figures).
5. **Adjudication.** Claude compares both passes field by field. For each disagreement, material change, new device and unresolved issue, Claude opens the sources itself and decides on evidence quality. Claude records the result in the ledger (`second_pass_result`, `final_disposition`).
6. **Reconcile.** After all batches are adjudicated, the results are reconciled into `devices_verified.csv`, `device_changes.csv`, `missing_devices_verified.csv` and `unresolved_issues.csv` for the integration review. Nothing reaches the live site without Thomas's approval of the integration proposal.

## 3. Ledger status columns

| Column | Values |
|---|---|
| `verification_status` | Starts `UNVERIFIED`; after adjudication, one of the six statuses. |
| `primary_done` | `NO` / `YES`. |
| `primary_action` | The primary pass's `action`. |
| `second_pass` | `PENDING` (not decided), `SELECTED`, `NOT_NEEDED`, `DONE`. |
| `second_pass_result` | `AGREES`, `DISAGREES`, or `PARTIAL`, with a note. |
| `final_disposition` | `KEEP`, `CORRECT`, `SPLIT`, `MERGE`, `REMOVE` or `HOLD` (stays as is, flagged). |
| `integrated` | `NO` / `YES`. |

## 4. When a row gets a second pass

A row goes to the other model when **any** of these is true. The primary researcher lists the matching reasons in `second_pass_reasons`, using these words:

| Reason | Trigger |
|---|---|
| `source conflict` | Primary sources disagree. |
| `PPI mismatch` | Official PPI differs from the calculated PPI by more than 2%. |
| `geometry uncertain` | No maker diagonal at full-rectangle precision, or only a nominal size. |
| `material change` | Any `CORRECT`, `SPLIT` or `MERGE` with `change_class` `material`. |
| `status` | Not `CONFIRMED`/`CORROBORATED`, or the product isn't `RELEASED`/`DISCONTINUED`. Every `RELEASE_CHECK` row is included automatically. |
| `foldable` | Foldable inner or cover screen with an unusual size, shape or naming. |
| `color e-ink` | Color e-ink with unclear monochrome/color resolution. |
| `possible duplicate` | A proposed new device may duplicate an existing row. |
| `source unavailable` | A cited source couldn't be opened or doesn't support the claim. |

**Quality-control sample.** Claude also sends a random sample of ordinary `KEEP` + `CONFIRMED` rows: 10% of them in each batch, at least 2 per batch, stratified so every batch and every category is represented. The sample is drawn with a recorded seed so it can be reproduced.

**Second-pass assignment:** Gemini verifies ChatGPT's batches, and ChatGPT verifies Gemini's. Claude checks B12 against the standards itself, and adjudicates everything.

**Adjudication rule:** evidence quality decides, never a vote. A manufacturer page beats a database, a database beats a retailer, and two AIs agreeing is not evidence.

## 5. Structure flags in the ledger

| Flag | Meaning for researchers |
|---|---|
| `GROUP` | Row covers several models. Verify each named model, and look for models with the same screen missing from the name. |
| `FOLD_INNER` / `FOLD_COVER` | One screen of a foldable phone. Verify that screen only. |
| `FOLDABLE_PC` | Foldable laptop; the row is the unfolded screen. |
| `ONE_OF_TWO_SCREENS` | Dual-screen device; one row per screen. |
| `COLOR_EINK` | Color e-ink. Keep the monochrome resolution; report the color resolution separately. |
| `CONFIGURABLE` | Sold with several panels. List them all in `panel_options`. |
| `GENERIC_CLASS` | Typical class, not a product. Verify with two current examples. |
| `APPLE_DIAGONAL` | Use Apple's "measured as a rectangle" figure. |
| `NAME_SIZE_DIFFERS` | The size in the name differs from the stored diagonal. Usually intentional (marketing vs measured); confirm. |
| `RELEASE_CHECK` | Claude couldn't confirm from its own knowledge (to mid-2026) that this device is released, or what its final specs are. Prove release from the maker, or mark it `RUMORED`/`ANNOUNCED`. Not a claim that it's wrong. |
| `SAME_SCREEN` | Another row has identical figures (listed in `prep_notes`). Verify independently, and consider whether grouping makes sense. |
| `NAME_DRIVES_CODE` | The app's code reads this name (display scaling, paper menu). A rename needs care at integration. |
| `FIRST_VISIT_DEFAULT` | Shown to every first-time visitor. |
| `HAS_OLD_IDS` | Older IDs already redirect to this row (`prep_notes` lists them). |
| `USED_IN_TESTS` | The automated tests name this device. |
| `PAPER_STD` | A paper, book or card size. |

## 6. Files per batch (naming)

```
device-audit/
  batches/B07_verification_results.csv          ← pre-filled, give to the primary model
  results/B07/primary/B07_verification_results.csv
  results/B07/primary/B07_missing_devices.csv
  results/B07/primary/B07_unresolved_issues.csv
  results/B07/primary/B07_summary.md             ← the model's end-of-batch summary, pasted as text
  results/B07/second_pass/B07_SP_verification_results.csv   (and the other two)
```
