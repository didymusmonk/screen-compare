# B10 adjudication (Claude, 2026-11-27)

Inputs: Gemini primary (36 rows, 10 new devices), ChatGPT blind second pass (8 rows: 1 release check + 7 QC sample; all 10 new devices). Field comparison: `B10_pass_comparison.csv`.

**Limitation:** Claude's sandbox can't open the cited sites (the environment's network policy refuses www.apple.com, psref.lenovo.com and similar hosts), so this adjudication compares the two passes' evidence; it hasn't re-read the pages. Statuses below reflect that.

## Existing rows
- All 36: final disposition **KEEP**. No figure is disputed. All 8 second-pass rows agree exactly on diagonal and pixels, each pass citing different pages.
- CONFIRMED after both passes: DEV-0032 Galaxy Tab S6 Lite, DEV-0037 Lenovo Tab P12 / Idea Tab Pro.
- **PARTIAL** (figures agree, but the second pass couldn't read a maker page; primary's links unverified): DEV-0039 Tab P11 Pro Gen 2, DEV-0044 Yoga Tab Plus, DEV-0047 Legion Tab, DEV-0049 Fire Max 11, DEV-0050 Fire HD 10, DEV-0052 Fire 7. The figures stay; only the status is held.
- The primary's Lenovo PSREF PDF links use different paths from the ones the second pass found (e.g. `Lenovo_Tab_P12/Lenovo_Tab_P12_Spec.pdf` vs `Tab_P12/Tab_P12_Spec.PDF`). Treat the primary's PSREF links as unverified until opened.
- The 28 rows outside the sample keep the primary's CONFIRMED (one pass only).

## Naming and grouping (for Thomas at integration, not changes now)
- Legion Tab: the verified panel is the 8.8" Gen 3; the Gen 2 has the same figures per the primary. The name could become "Lenovo Legion Tab (Gen 2 / Gen 3)" (needs a RENAMED entry) or stay.
- Fire HD 10 / Fire 7 / Fire HD 8: generations share screens; names could list years. Optional.
- Identical-screen rows that could be grouped: the four Tab S Ultra rows, Tab S10+ / S9+ / S8+ / S7+, Tab P12 / Idea Tab Pro / Yoga Tab Plus. Recommendation: keep separate rows (visitors search by model), don't merge.

## New devices (10)
Both passes agree on all figures. Accepted as candidates for the integration proposal:
Galaxy Tab S10 Lite (10.9", 2112 x 1320, **228.5 ppi**; the primary's 239 was a calculation slip), OnePlus Pad (11.61", 2800 x 2000), OnePlus Pad Go (11.35", 2408 x 1720), Xiaomi Pad 6 (11", 2880 x 1800), Xiaomi Pad 6S Pro 12.4 (3048 x 2032), Redmi Pad Pro (12.1", 2560 x 1600), Redmi Pad SE (11", 1920 x 1200, same screen as DEV-0033/DEV-0041), Huawei MatePad 11.5S (2800 x 1840), Huawei MatePad Pro 12.2 (2800 x 1840), Honor MagicPad 2 (12.3", 3000 x 1920).
Priorities differ between passes (essential vs useful); settle them in the integration proposal.
