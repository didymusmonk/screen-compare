# AGENTS.md: rules for every AI coding agent

This file is the authoritative set of development instructions for **every AI coding agent** working on True Size Screens, including Claude (Anthropic) and ChatGPT/Codex (OpenAI). Agent-specific files such as `CLAUDE.md` may add tool-specific notes but must not contradict this file. If they do, this file wins, and the conflict should be reported to the owner.

The owner is **Thomas** (GitHub `didymusmonk`, published as DidymusMonk), a first-time app builder. Explain changes in plain, beginner-friendly English.

## 1. Where project knowledge lives

The **repository is the single source of truth.** Previous AI conversations, chat memories and project folders outside the repo are not authoritative. If something you remember disagrees with the repo, trust the repo, and if the repo seems wrong, say so in your pull request instead of silently "fixing" it.

| Read this | For |
|---|---|
| `README.md` | What the site does, how to run it locally, how to edit devices, how to update pdf.js |
| `AGENTS.md` (this file) | The development protocol and the constraints you must respect |
| `docs/ARCHITECTURE.md` | How the code is organised, data flows, the maths, storage, caching and offline behavior |
| `docs/DECISIONS.md` | Why things are the way they are: decisions, alternatives considered, verified facts, estimates and open questions |
| `docs/HANDOVER.md` | Current status, known bugs, work underway, fragile areas, tasks open for a second agent |
| `CHANGELOG.md` | Short history of significant changes |
| `tests/README.md` | How the tests are organised and run |

Read `AGENTS.md`, `docs/HANDOVER.md` and the relevant parts of `docs/DECISIONS.md` before starting any task.

## 2. Development protocol (applies to all agents)

These rules replace the earlier practice (until 27 Nov 2026) of committing straight to `main`.

1. **Start from the latest approved `main`.** Fetch `origin/main` and branch from it. Don't build on another task's unmerged branch unless Thomas asks.
2. **One branch per task.** Name it after the agent and the task, for example `claude/fix-tablet-pc-match` or `codex/review-share-links`. (Hosted Claude sessions may be assigned a branch name by their environment; that's fine.)
3. **Never push to `main` and never merge without Thomas's approval.** Open a pull request and wait. Merging to `main` is deploying: GitHub Pages publishes `main` to the live site within minutes.
4. **Don't touch another agent's active branch** (commits, force-pushes, rebases) without Thomas's explicit permission. Review it, comment on it, or propose changes in your own branch instead.
5. **Keep changes narrowly focused** on the requested task. One task, one pull request.
6. **No unsolicited refactoring, architectural changes, new dependencies or database expansion.** That includes adding devices to `devices.csv`, adding columns, adding a build step, a framework, an npm runtime dependency, a CDN, a backend or an outside service. Propose these in the pull request description or an issue instead.
7. **Preserve backward compatibility** unless Thomas explicitly authorizes otherwise. In this project that especially means saved settings (`localStorage` keys `tss:*`), share links (`#s=...`), device IDs (see section 4), and offline copies held by visitors' service workers.
8. **Run the regression tests before submitting**: `node tests/run-all.js` (setup in `tests/README.md`). GitHub Actions also runs them on every pull request. Report the result honestly, including failures and anything you could not run (for example real-iPhone checks).
9. **Add targeted regression tests** for new features and bug fixes where appropriate: a hand-worked value in `tests/unit.js` for new maths, a check in `tests/browser.js` that fails without the fix for a bug, and one quick check in `tests/smoke.js` for a new feature. **Never weaken, skip or delete an existing check** to make a change pass.
10. **Document what you did** in the pull request: files changed, decisions made, assumptions, unresolved issues and possible regressions. Add a line to `CHANGELOG.md` for significant changes. Update `docs/` when you change architecture, a decision or a known limitation.
11. **Check for conflicts with existing decisions before implementing.** If a request conflicts with `docs/DECISIONS.md`, stop and describe the conflict to Thomas before writing code.
12. **Prefer simple, maintainable solutions** over clever ones. Thomas edits files on GitHub by hand.
13. **Before opening the pull request, rebase (or merge) onto the latest `origin/main`** and re-run the tests if anything changed.
14. **Independent review.** When asked to review another agent's pull request, check it against this file and `docs/DECISIONS.md`, run the tests yourself, and report findings in the pull request. Don't push fixes to their branch.

### Pull request checklist

- [ ] Branched from the latest `main`; rebased before opening
- [ ] Only files the task needs were changed
- [ ] `node tests/run-all.js` passes (or failures explained)
- [ ] New or fixed behavior has a regression test
- [ ] No new dependency, outside service, build step or database expansion (or explicitly approved)
- [ ] Saved settings, share links, device IDs and offline copies still work
- [ ] `CHANGELOG.md` and `docs/` updated where relevant
- [ ] Description lists assumptions, open questions and possible regressions

## 3. What the project is

A free static website that compares phone, tablet, e-reader, tablet PC, laptop and monitor screens at true relative size, with pixel density and previews of pages, PDFs, video, e-books and websites on each screen.

- Live: https://didymusmonk.github.io/screen-compare/ (GitHub Pages, `main`, root folder)
- Static, no build step, no framework, no backend, no runtime npm packages. The app is one file, `index.html` (HTML, CSS and JS). Devices are in `devices.csv`.
- Visitors: about 79% on phones and 95% Safari (GoatCounter, Nov 2026). **Test phone layouts and iOS Safari behavior first.**
- Inspired by what comparisontabl.es does, but must **never copy its look, wording or code**.
- Website previews are **generic and unbranded**. Product names are trademarks of their owners.

## 4. Constraints that must not be broken

Details and reasons are in `docs/DECISIONS.md`. In short:

- **Geometry:** physical size comes only from the diagonal and the pixel aspect ratio (`geom()`). Outlines show the active screen area, never bezels. Don't add hidden size corrections.
- **Device IDs** are `slug(name)` ("+" becomes "plus"). Renaming a device changes its ID: add the old ID to `RENAMED` in `index.html` (one hop only; retarget older entries). Two names must never produce the same ID. Keep the three first-visit IDs working.
- **`devices.csv`** has exactly the header `name,type,diagonal,width,height`, one row per line (no line breaks inside quoted cells). The README's device count must match the CSV (a unit test checks it). Unreleased or rumored devices are left out.
- **Device names drive code:** `dprOf()`, "Compare with my screen" and the paper menu match on name patterns. Check them before renaming.
- **Privacy:** PDFs never leave the browser. No outside services except GoatCounter analytics (GitHub copy only). Custom screens stay in the visitor's browser; collecting them was declined.
- **Offline:** if you change `sw.js`, an icon or the manifest, bump `VERSION` in `sw.js`. pdf.js upgrades change `PDFJS` in `index.html`, `PDFJS_VERSION` in `sw.js` and the folder name together (README steps).
- **pdf.js must stay the legacy build** (the modern build breaks iOS Safari).
- **Calibration** only sets the drawing scale in "Actual size"; it never changes a card number, and it is never put in share links.
- **Reference comparison** percentages come from the same `statsOf()` the cards use; zoom and calibration never affect them.
- **Accessibility:** text contrast at least 4.5:1 in both themes, every control usable by keyboard, axe-core clean, the SVG stage keeps its `aria-label`, Free arrange announces changes through `#sr-live`, and focus is restored after redraws.
- **Phone layout (≤700 px):** sticky `#quickbar`, a "More options" toggle, touch targets at least 44 px, 16 px inputs (so iOS doesn't zoom).
- **Methodology page:** `methodology.html` explains the calculations to visitors. Update it in the same change whenever a calculation or a privacy fact changes.

## 5. Conventions

- Plain JavaScript with small helpers: `$` for `querySelector`, `esc()` for HTML escaping (use it for every visitor- or CSV-supplied string put into HTML), `store` for `localStorage`.
- All state is in one object, `S`. Every change calls `save()` and then `renderAll()`.
- `tests/unit.js` copies functions out of `index.html` by text: **top-level declarations in the main script start at column 0, and multi-line ones end with a line starting with `}` or `]`.** Keep that formatting.
- Every user-facing string is plain English in sentence case. Avoid jargon, or explain it in the glossary.
- Commit messages: a short, plain-English summary line, then details if needed.
- Device rows: `name,type,diagonal,width,height`. Paper rows leave `diagonal` empty and give inches. Sorting: see `docs/DECISIONS.md`.

## 6. `index.html` is the only source

The repository's `index.html` is the **only** authoritative, editable copy of the app (decided by Thomas, 27 Nov 2026). Every agent edits it directly, on a branch, like any other file. There is no build step and no generated copy to keep in sync.

- The `<head>` is in two parts. Everything **above the `<title>` line** is for the live site only (meta description, Open Graph and Twitter tags, favicon, canonical link, manifest, Apple tags, theme colors, a small base style). The `<title>` line and everything after it is the app itself.
- The two `<script>` tags just before `</body>` register the service worker (offline use) and load GoatCounter (analytics). They are live-site only too. Keep them as they are, and keep the service worker one as a single line containing `navigator.serviceWorker.register`.
- Claude can make a temporary preview of a branch from this file (see `CLAUDE.md`). The preview is always generated **from** the repo and is never copied back into it. Nothing in the repo depends on it.

## 7. Agent-specific files

- `CLAUDE.md`: Claude-specific notes (the temporary Artifact preview, running tests in Claude's cloud sandbox, project memory). It defers to this file.
- Codex reads this file (`AGENTS.md`) directly. Put any future Codex-only notes in a clearly marked section at the end of this file rather than in a separate file, unless Thomas decides otherwise.
