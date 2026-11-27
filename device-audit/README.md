# Device database audit (working folder)

This folder exists only on the `device-database-audit` branch. It isn't part of the website: the live site is built from `main`, nothing on the page links here, and the offline cache never stores it, so it adds nothing to what visitors download.

| File | What it's for |
|---|---|
| `devices_original.csv` | Frozen copy of `devices.csv` at the start of the audit (main, commit 31bc528). Never edit it. |
| `DATABASE_CONTRACT.md` | How the device list works: fields, IDs, geometry, grouping, compatibility rules, and the results file format. |
| `MASTER_PROMPT.md` | Instructions for every AI model: Thomas's master instructions, rules for this database, and role cards. |
| `BATCH_MANIFEST.md` | The 12 batches, who researches what, second-pass rules and the flag legend. |
| `COVERAGE_LEDGER.csv` | One line per original row (`DEV-0001` to `DEV-0315`), with batch, flags, notes and status columns. |
| `batches/` | One pre-filled `verification_results` file per batch, ready to hand to a model. |
| `templates/` | Empty headers for the three results files. |
| `results/` | Where returned files go (`results/<batch>/primary/`, `results/<batch>/second_pass/`). |
| `tools/build_ledger.py` | Rebuilds the ledger and batch files from the baseline. Don't re-run it after research starts (it resets the status columns). |
| `tools/check_results.py` | Checks returned files: columns, allowed values, IDs, untouched original cells, every row answered. |

## Starting a batch in ChatGPT (B01 to B06) or Gemini (B07 to B11)

**Upload once** to a ChatGPT Project (Project files) or a Gemini Gem (Knowledge), so every chat in it can see them:

1. `MASTER_PROMPT.md`
2. `DATABASE_CONTRACT.md`
3. `BATCH_MANIFEST.md`
4. `COVERAGE_LEDGER.csv`
5. `templates/missing_devices_header.csv` and `templates/unresolved_issues_header.csv`

**For each batch, start a new chat** inside that Project or Gem, attach that batch's file from `batches/` (for example `B02_verification_results.csv`), turn on web search, and send the role card from `MASTER_PROMPT.md` Part C1 with the batch number and today's date filled in.

**When it finishes**, download the three CSV files (or copy the three code blocks into files with those names), and copy its end-of-batch summary. Bring them back to Claude, who checks them and records them here.

Deep Research modes (ChatGPT's deep research, Gemini's Deep Research) can be used for the discovery sweep, but they tend to return prose reports rather than files, so ask them to end with the three CSV files in code blocks.

One batch per chat keeps each conversation short enough for the model to stay accurate. If a model stops partway, ask it to return what's finished; unfinished rows stay marked `not reached`.
