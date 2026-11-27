# True Size Screens

Compare phone, tablet, laptop, tablet PC (including Surface Pro) and monitor screens at true relative size.

- Search 343 built-in screens plus 30 paper, book and card sizes, or enter your own screen (diagonal plus resolution or aspect ratio)
- See each screen's pixel density (PPI), resolution, megapixels, aspect ratio and physical size
- Preview how Letter, A4, Legal and other page sizes, or your own PDF, fit on each screen
- Video mode shows the picture's real size, diagonal and area without the black bars
- Set one screen as the reference to see how the others compare, in percent: size, pages, video, e-book or websites
- Side by side, overlay, or free arrange with drag, snapping guides and rotation
- Calibrate "Actual size" with a bank card to see screens at real size on your monitor
- Works offline after your first visit, including from your Home Screen

It's a single static `index.html` with no build step and no server. PDFs open in your browser and are never uploaded. [`methodology.html`](methodology.html) (linked as "Methodology" in the footer) explains how every number is worked out, how the device list was checked, and what the site can't show.

## Running it locally

There's nothing to build or install. Serve the folder with any local web server (opening `index.html` straight from disk shows no devices, because browsers block loading `devices.csv` from `file://`):

```
python3 -m http.server 8000
```

Then open http://localhost:8000/.

## Development and testing

- The tests need [Node.js](https://nodejs.org) 18+ and Playwright; setup is in [`tests/README.md`](tests/README.md). Run everything with `node tests/run-all.js`. GitHub runs the same tests on every pull request.
- Every change is made on its own branch and submitted as a pull request. Nothing is merged to `main` (which is the live site) without the owner's approval.
- Rules for AI coding agents (Claude, Codex and others) are in [`AGENTS.md`](AGENTS.md).

| Document | What's in it |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Development protocol and project constraints for all contributors |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the code is organised, data flows, calculations, caching and offline behavior |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Design decisions, their reasons, and what must be respected |
| [`docs/HANDOVER.md`](docs/HANDOVER.md) | Current status, known bugs, fragile areas, open tasks |
| [`CHANGELOG.md`](CHANGELOG.md) | History of significant changes |
| [`methodology.html`](methodology.html) | How every number is worked out, for visitors |

## Adding or fixing a device

The built-in list is in [`devices.csv`](devices.csv), one screen per line:

```
name,type,diagonal,width,height
Surface Pro 9,tablet pc,13.0,2880,1920
```

- **type** is one of `phone`, `tablet`, `ereader`, `tablet pc`, `laptop`, `monitor`, `paper`
- **diagonal** is in inches, and **width** and **height** are the screen's pixel count
- For `paper`, leave **diagonal** empty and give **width** and **height** in inches, for example `A4 paper,paper,,8.268,11.693`
- Wrap a name in double quotes if it contains a comma, and write a `"` inside a quoted name as `""`

To edit it on GitHub, open `devices.csv`, click the pencil icon, make your change and click **Commit changes**. The live site updates in a minute or two.

## The PDF reader (pdf.js)

PDF previews use [pdf.js](https://mozilla.github.io/pdf.js/) **6.5.438** by Mozilla, the "legacy" build (the one that supports Safari), in [`pdfjs/6.5.438/`](pdfjs/6.5.438/). It loads only when someone opens a PDF, and works offline once a PDF has been opened online. The folder is named after the version so a visitor's saved copy of one version can never mix with another.

To update it later:

1. Check the latest version on [npm](https://www.npmjs.com/package/pdfjs-dist) and read the [release notes](https://github.com/mozilla/pdf.js/releases) since 6.5.438, looking for changes to `getDocument()` options, the worker or supported browsers.
2. Download the package: `npm pack pdfjs-dist@<version>` and unpack it (`tar xzf pdfjs-dist-<version>.tgz`).
3. Make a folder `pdfjs/<version>/` and copy into it, unchanged, from the package's **`legacy/build/`** folder: `pdf.min.mjs` and `pdf.worker.min.mjs`; the package's `LICENSE`; and from its `wasm/` folder into `pdfjs/<version>/wasm/`: `jbig2.wasm`, `openjpeg.wasm`, `qcms_bg.wasm`, `jbig2_nowasm_fallback.js`, `openjpeg_nowasm_fallback.js` and the `LICENSE_*` files for JBIG2, OpenJPEG and QCMS. Always take every file from the same package so the library and worker versions match.
4. In `index.html`, change the folder in `const PDFJS = ... "pdfjs/6.5.438/"`. In `sw.js`, change `PDFJS_VERSION` to the same number.
5. Delete the old `pdfjs/<old version>/` folder.
6. Run `node tests/smoke.js` (see [`tests/README.md`](tests/README.md)). It checks that the three version numbers agree, and that PDFs open online and offline. Then try a PDF on an iPhone.

## License

MIT License, © 2026 DidymusMonk. See [LICENSE](LICENSE). The PDF preview uses [pdf.js](https://mozilla.github.io/pdf.js/) 6.5.438 by Mozilla, included in [`pdfjs/6.5.438/`](pdfjs/6.5.438/) under the Apache License 2.0 ([LICENSE](pdfjs/6.5.438/LICENSE)), with image decoders under their own licenses in [`wasm/`](pdfjs/6.5.438/wasm/). Product names are trademarks of their owners.
