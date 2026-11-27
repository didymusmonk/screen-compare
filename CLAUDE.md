# True Size Screens: notes for Claude

@AGENTS.md

**`AGENTS.md` (imported above) is the authoritative instruction file for every AI agent, Claude included.** Read it first, then `docs/HANDOVER.md`, and the parts of `docs/DECISIONS.md` and `docs/ARCHITECTURE.md` that the task touches. This file only adds what is specific to Claude's tools and Thomas's Claude project. If anything here conflicts with `AGENTS.md`, `AGENTS.md` wins.

Since 27 Nov 2026 Claude no longer commits straight to `main`: work on a branch, open a pull request, and wait for Thomas to approve the merge (`AGENTS.md` section 2). OpenAI Codex also works on this repository as a second developer and reviewer, so don't touch its branches (usually `codex/...`) without Thomas's permission.

## The Artifact preview (temporary, generated from the repo)

Since 27 Nov 2026 the repository's `index.html` is the only source (`AGENTS.md` section 6). Edit it in the repo, on your branch. The old project-folder workflow (`/mnt/project-files/screen-compare/index.html` as the source, built into the repo copy by `wrap.sh`) is **retired**: never edit those files and never copy anything from the project folder into the repo.

Thomas's preview Artifact is https://claude.ai/artifact/WhqeFfcgT7a4HBnUySpaFa. To show a branch there (only when Thomas asks, or after a merge):

1. Generate the preview page from the repo file into your scratchpad (it leaves out the live-site-only head tags above `<title>`, the `</head>`/`<body>` lines, and everything from the service worker script on):
   ```
   awk '/^<title>/{on=1} /^<\/head>$/||/^<body>$/{next} /navigator\.serviceWorker\.register/{exit} on' index.html > <scratchpad>/preview/index.html
   ```
   On 27 Nov 2026 this reproduced the last preview source byte for byte. If the result is empty or much shorter than `index.html`, someone moved the `<title>` line or the service worker line: look before publishing.
2. Publish that file to the same Artifact URL, with `devices.csv` and `methodology.html` from the repo as extra files. pdf.js files already published there are kept between publishes; republish them only after a pdf.js upgrade (below).
3. Never commit the generated file or write it back over the repo copy.

What the preview can't do (tell Thomas when it matters): it has no service worker (no offline test), no analytics, none of the live site's link-preview or Home Screen tags, and it runs inside Claude's Artifact frame, so it isn't a test of iOS Safari. Saved settings there are separate from the live site's. Use the tests and the live site after a merge for those.

Other notes about the old project folder:

- `devices.csv` and `methodology.html` there are retired copies; the repo versions are the source.
- `gen_csv.py` (sorts `devices.csv` by category, brand and family) still lives only in the project folder. The sort rules are in `docs/DECISIONS.md` section 2. `gen_csv_legacy.py` and `raw.json` are stale: never use them, they would undo the device audit.
- The project folder adds C2PA metadata to SVG files written there (it bloated `favicon.svg` from 316 bytes to 8 KB). Edit `favicon.svg` in the repo itself.

## Artifact preview and pdf.js

When pdf.js is upgraded (README steps), also republish the Artifact preview (generated as above) with the new files (`.mjs` as `text/javascript`, `.wasm` as `application/wasm`) and the old paths removed. The Artifact service refuses text files containing an ESC byte, and `pdf.worker.min.mjs` 6.5.438 has two inside string literals, so the preview's copy has them written as `\x1b` (same behavior, checked by rendering the sample PDFs). The repo copy stays unchanged.

Background research behind the pdf.js choice: Safari audit (Nov 2026, Claude Doc, visible to Thomas's account): https://claude.ai/artifact/C8pkfzDjYNn6n9H49pJjR2. Its conclusions are recorded in `docs/DECISIONS.md` section 5.

## Running the tests in a Claude cloud session

Don't `npm install` Playwright in `tests/` (a local copy can't find the preinstalled browser). Install only `axe-core` into the scratchpad and run:

```
NODE_PATH=<scratchpad>/node_modules:/opt/node22/lib/node_modules node tests/run-all.js
```

The sandbox's proxy blocks `didymusmonk.github.io` and Playwright's WebKit download; see `tests/README.md` for the WebKitGTK runner. One-off Playwright scripts are fine for deeper checks such as touch drag.

## Project memory

Claude project memory is a convenience, not a source of truth. When you learn a lasting fact about the project, put it in the repo's docs (in your pull request) so Codex and future sessions see it too.
