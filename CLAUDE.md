# True Size Screens: notes for Claude

@AGENTS.md

**`AGENTS.md` (imported above) is the authoritative instruction file for every AI agent, Claude included.** Read it first, then `docs/HANDOVER.md`, and the parts of `docs/DECISIONS.md` and `docs/ARCHITECTURE.md` that the task touches. This file only adds what is specific to Claude's tools and Thomas's Claude project. If anything here conflicts with `AGENTS.md`, `AGENTS.md` wins.

Since 27 Nov 2026 Claude no longer commits straight to `main`: work on a branch, open a pull request, and wait for Thomas to approve the merge (`AGENTS.md` section 2). OpenAI Codex also works on this repository as a second developer and reviewer, so don't touch its branches (usually `codex/...`) without Thomas's permission.

## Thomas's Claude project folder

Working copies sit outside the repo, in the Claude project folder `/mnt/project-files/screen-compare/`. They are not authoritative: **the repository is.** Before editing them, check they match the latest `main` (Codex and merged pull requests change the repo directly).

- `index.html` there is the **Artifact preview source**, without the `<!doctype>`/`<head>` wrapper. Preview: https://claude.ai/artifact/WhqeFfcgT7a4HBnUySpaFa (publish it with `devices.csv` as an extra file). Republish it only after the change is approved or when Thomas asks.
- `wrap.sh` builds the repo's `index.html` from that source: it adds the doctype, meta description, Open Graph and Twitter tags, favicon, canonical link, manifest and Apple tags, theme color, and the service worker registration and GoatCounter script (GitHub copy only). Don't hand-edit the two copies separately.
- **Sync first.** If the repo's `index.html` changed since the preview source was last built (for example a Codex pull request was merged), recreate the preview source from the repo copy before editing: the lines after the `<style>[hidden]...` line that `wrap.sh` writes, without the `</head>` and `<body>` lines `wrap.sh` inserts, and without the last 5 lines (service worker script, GoatCounter script, `</body>`, `</html>`). For example: `awk 'NR>25' index.html | grep -v '^</head>$' | grep -v '^<body>$' | head -n -5` (check the line number of the `<style>[hidden]` line first; it was 25 on 27 Nov 2026, when this reproduced the preview source byte for byte). Then check that `wrap.sh` rebuilds a file identical to the repo copy.
- `methodology.html` is the same file in the repo and the project folder (not built by `wrap.sh`).
- `devices.csv` itself is the source since the Nov 2026 device audit. `gen_csv.py <in.csv> <out.csv>` only sorts it. The old `gen_csv_legacy.py` and `raw.json` are stale: never use them, they would undo the audit.
- The project folder adds C2PA metadata to SVG files written there (it bloated `favicon.svg` from 316 bytes to 8 KB). Edit `favicon.svg` in the repo itself and don't copy it back.

## Artifact preview and pdf.js

When pdf.js is upgraded (README steps), also republish the Artifact preview with the new files (`.mjs` as `text/javascript`, `.wasm` as `application/wasm`) and the old paths removed. The Artifact service refuses text files containing an ESC byte, and `pdf.worker.min.mjs` 6.5.438 has two inside string literals, so the preview's copy has them written as `\x1b` (same behavior, checked by rendering the sample PDFs). The repo copy stays unchanged.

Background research behind the pdf.js choice: Safari audit (Nov 2026, Claude Doc, visible to Thomas's account): https://claude.ai/artifact/C8pkfzDjYNn6n9H49pJjR2. Its conclusions are recorded in `docs/DECISIONS.md` section 5.

## Running the tests in a Claude cloud session

Don't `npm install` Playwright in `tests/` (a local copy can't find the preinstalled browser). Install only `axe-core` into the scratchpad and run:

```
NODE_PATH=<scratchpad>/node_modules:/opt/node22/lib/node_modules node tests/run-all.js
```

The sandbox's proxy blocks `didymusmonk.github.io` and Playwright's WebKit download; see `tests/README.md` for the WebKitGTK runner. One-off Playwright scripts are fine for deeper checks such as touch drag.

## Project memory

Claude project memory is a convenience, not a source of truth. When you learn a lasting fact about the project, put it in the repo's docs (in your pull request) so Codex and future sessions see it too.
