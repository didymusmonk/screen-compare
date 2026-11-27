# True Size Screens: notes for Claude

@AGENTS.md

Follow the shared workflow in `AGENTS.md`. Use targeted searches and line ranges when reading `index.html`.

## Artifact preview

Generate previews from the repository copy. The old project-folder copies and `wrap.sh` are retired.

Thomas's preview Artifact is https://claude.ai/artifact/WhqeFfcgT7a4HBnUySpaFa. To show a branch there (only when Thomas asks, or after a merge):

1. Generate the preview page from the repo file into your scratchpad (it leaves out the live-site-only head tags above `<title>`, the `</head>`/`<body>` lines, and everything from the service worker script on):
   ```
   awk '/^<title>/{on=1} /^<\/head>$/||/^<body>$/{next} /navigator\.serviceWorker\.register/{exit} on' index.html > <scratchpad>/preview/index.html
   ```
   If the result is empty or much shorter than `index.html`, someone moved the `<title>` line or the service worker line: look before publishing.
2. Publish that file to the same Artifact URL, with `devices.csv` and `methodology.html` from the repo as extra files. pdf.js files already published there are kept between publishes; republish them only after a pdf.js upgrade (below).
3. Never commit the generated file or write it back over the repo copy.

What the preview can't do (tell Thomas when it matters): it has no service worker (no offline test), no analytics, none of the live site's link-preview or Home Screen tags, and it runs inside Claude's Artifact frame, so it isn't a test of iOS Safari. Saved settings there are separate from the live site's. Use the tests and the live site after a merge for those.

## Artifact preview and pdf.js

When pdf.js is upgraded (README steps), also republish the Artifact preview (generated as above) with the new files (`.mjs` as `text/javascript`, `.wasm` as `application/wasm`) and the old paths removed. The Artifact service refuses text files containing an ESC byte, and `pdf.worker.min.mjs` 6.5.438 has two inside string literals, so the preview's copy has them written as `\x1b` (same behavior, checked by rendering the sample PDFs). The repo copy stays unchanged.

## Running the tests in a Claude cloud session

Don't `npm install` Playwright in `tests/` (a local copy can't find the preinstalled browser). Install only `axe-core` into the scratchpad and run:

```
NODE_PATH=<scratchpad>/node_modules:/opt/node22/lib/node_modules node tests/run-all.js
```

The sandbox's proxy blocks `didymusmonk.github.io` and Playwright's WebKit download; see `tests/README.md` for the WebKitGTK runner. One-off Playwright scripts are fine for deeper checks such as touch drag.
