# Device database audit (working folder)

This folder exists only on the `device-database-audit` branch. It isn't part of the website: the live site is built from `main`, nothing on the page links here, and the offline cache never stores it.

## Simplified workflow (since 27 Nov 2026)

The first plan (two AI models per batch, an independent second pass, then adjudication) was too much work for a hobby project. B02 (Apple) and B10 (Android tablets) finished under that plan and are kept as they are. From now on:

1. **Gemini researches once.** No second pass. On 27 Nov 2026 Thomas ran every remaining batch (B01, B03 to B09, B11, B12) through Gemini, one pass each, so all 315 original rows now have an answer.
2. **Scripts check everything that doesn't need judgment**: file format (with automatic repair of shifted columns), numbers, maths, duplicates, grouping, categories, foldable pairs, colour e-ink, and compatibility with saved comparisons and share links.
3. **Claude looks only at the exceptions** and records rulings in `decisions.csv`. On 27 Nov 2026 that meant checking Amazon's and Samsung's pages where Gemini again called real products rumored (2025 Kindle Scribe, 2026 Kindles) and inverted Samsung's full-rectangle footnote (Fold8 cover).

| Batches | Rows | Research |
|---|---:|---|
| B02 Apple iPad, Mac, displays; B10 Android tablets | 63 | Two passes + adjudication (old plan) |
| B01, B03 to B09, B11, B12 | 252 | One Gemini pass (Thomas, 27 Nov 2026), repaired and checked by script |
| B06 and B12 also | 51 | Also checked by Claude's script against the standards (`results/B06|B12/claude_script_check/`) |

For future rounds (new devices, a yearly refresh), `GEMINI_PROMPT.md` and the four combined group files in `assignments/` replace the nine separate batches.

### Thomas's steps for a future Gemini round

1. Once: make a Gemini Gem and paste the instructions from `GEMINI_PROMPT.md` (everything below its line).
2. New chat in the Gem, attach `assignments/G1_verification_results.csv`, turn on web search, send "Group G1. Today is <date>."
3. Bring the three CSV files it returns to Claude.

### Claude's steps per returned group

```
python3 device-audit/tools/realign_csv.py <returned.csv> /tmp/a.csv       # puts shifted cells back in their columns
python3 device-audit/tools/repair_csv.py /tmp/a.csv <repaired.csv>        # number formatting of original_* cells
#   save the files as device-audit/results/G1/primary/G1_verification_results.csv (and the other two)
python3 device-audit/tools/check_results.py --coverage                    # format and completeness
python3 device-audit/tools/build_proposal.py                              # rebuilds proposal/ and runs validate_db.py
```

Then Claude reads `proposal/EXCEPTIONS.md`, checks only what it lists (sources for significant corrections, release questions, essential new devices), records rulings in `decisions.csv`, and re-runs the builder.

### Accuracy rules (applied by `build_proposal.py`)

- One reliable manufacturer source is enough; a reputable secondary source where the maker has nothing.
- Differences under 0.5% in physical size with the same pixels are rounding: the row is kept as is.
- Larger changes backed by a confirmed source are applied and listed as significant corrections.
- Anything uncertain keeps its current figures, is marked `partial`, `estimated` or `unverified`, and is listed. It never blocks completion.
- Renames, category changes, splits and merges are never applied automatically, because they change the IDs that saved comparisons and share links use. They're listed for Thomas's approval with the RENAMED entries they'd need.

## The deliverables (in `proposal/`, rebuilt by `build_proposal.py`)

| File | What it is |
|---|---|
| `devices_verified.csv` | **The proposed device database**: the `devices.csv` columns plus `audit_id`, `source_url`, `reported_ppi`, `color_ppi`, `status`, `geometry_note`. |
| `EXCEPTIONS.md` | **The exceptions report**: significant corrections, disputes, release questions, uncertain rows, proposed renames, researcher issues, ignored rounding, automatic check results, rows not yet researched. |
| `MISSING_DEVICES_SUMMARY.md` | **Proposed additions**: added, same screen as an existing row, optional, review queue. |
| `device_changes.csv`, `missing_devices_verified.csv`, `renamed_additions.csv` | The detail behind those, in the formats of `DATABASE_CONTRACT.md` section 9, with an empty `approved` column for Thomas. |
| `VALIDATION.md`, `validation_findings.csv` | Full output of `validate_db.py` on the proposal. |

Nothing here reaches the site until Thomas approves the integration. Integration then updates `devices.csv` (through `raw.json` and `gen_csv.py`), `RENAMED` in `index.html`, the README count and tests, and runs `node tests/run-all.js`.

## Files

| File | What it's for |
|---|---|
| `GEMINI_PROMPT.md` | The one reusable research prompt, with the group table. |
| `assignments/` | One input file per Gemini group (`tools/make_assignments.py` makes them from `batches/`). |
| `decisions.csv` | Claude's rulings that override the automatic rules (B02 and B10 adjudications are recorded here). |
| `devices_original.csv` | Frozen copy of `devices.csv` at the start of the audit (main, commit 31bc528). Never edit it. |
| `DATABASE_CONTRACT.md` | How the device list works: fields, IDs, geometry, grouping, compatibility rules, results file format. Still current. |
| `COVERAGE_LEDGER.csv` | One line per original row (`DEV-0001` to `DEV-0315`) with batch, flags, notes and status. |
| `MASTER_PROMPT.md`, `BATCH_MANIFEST.md` | The original two-model plan. Kept for the record and for the flag legend; superseded by this README and `GEMINI_PROMPT.md`. |
| `batches/`, `templates/` | Pre-filled batch files and empty headers. |
| `results/` | Returned research. B02 and B10 have primary, second pass and adjudication; B06 and B12 have Claude's script checks. |
| `tools/validate_db.py` | Checks a whole device list (any `devices.csv`-style file). |
| `tools/build_proposal.py` | Builds the deliverables from all results and `decisions.csv`. |
| `tools/check_results.py`, `tools/realign_csv.py`, `tools/repair_csv.py` | Check returned files; put shifted cells back; repair other mechanical CSV slips. |
| `tools/test_tools.py` | Self-test: planted faults that `validate_db.py` must catch. |
| `tools/build_ledger.py`, `make_second_pass.py`, `compare_passes.py` | Old-plan tools. Don't re-run `build_ledger.py` (it resets the status columns). |
