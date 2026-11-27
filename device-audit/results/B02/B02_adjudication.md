# B02 adjudication (Claude, 2026-11-27)

Inputs: ChatGPT primary (27 rows, 21 new devices, 2 splits), Gemini blind second pass (14 rows: 8 triggered + 6 QC; all 21 new devices). Comparison: `B02_pass_comparison.csv` (33 of 35 figures agree).

## The disagreement: are Apple's late-2026 Macs real?
Gemini marked five candidates RUMORED ("no evidence"): MacBook Pro 14"/16" with PROLED XDR, MacBook Pro 14" M6, iMac M6, Studio Display XDR. ChatGPT said released. Claude opened Apple's pages (via the fetch tool, 2026-11-27); every page loaded:
- apple.com/macbook-pro/proled-xdr-display/specs/: "14.2-inch (diagonal) tandem OLED display; 3024-by-1986 native resolution at 254 pixels per inch" and "16.3-inch (diagonal) tandem OLED display; 3472-by-2266 native resolution at 254 pixels per inch".
- Newsroom press release "Apple unveils groundbreaking MacBook Pro with PROLED XDR Display", October 28, 2026.
- support.apple.com/en-us/148300 "MacBook Pro (14-inch, M6) - Tech Specs": "14.2-inch (diagonal) Liquid Retina XDR display; 3024-by-1964 native resolution at 254 pixels per inch"; "Year introduced: 2026".
- Newsroom "Apple unveils new iMac with M6", October 27, 2026; apple.com/imac/specs/: "4480-by-2520 resolution at 218 pixels per inch", "Actual diagonal screen size is 23.5 in."
- apple.com/studio-display-xdr/specs/: "27-inch (diagonal) 5K Retina XDR display"; "5120-by-2880 resolution at 218 pixels per inch" (no date on the page).
- Newsroom "Apple gives iPad mini its biggest update ever", October 26, 2026 (8.5-inch OLED).
**Ruling: ChatGPT is right; Gemini's RUMORED rulings are rejected.** Gemini's figures for the PROLED models (3024 x 1964, 16.2" 3456 x 2234) were copied from the LCD models and are wrong. Gemini also listed only M2/M3 for the MacBook Air groups and stopped the MacBook Pro groups at M4, so it was missing recent Apple models generally. Lesson added to MASTER_PROMPT: never mark a product rumored without searching the maker's newsroom and spec pages.

## Existing rows
- All 27: figures **unchanged** (KEEP). The 14 checked rows agree exactly.
- DEV-0239 / DEV-0240 (MacBook Pro 14"/16" Liquid Retina XDR): no split of the existing row. The row stays the LCD panel. The PROLED panels become new rows (below). The names could become "(M1 to M6)" once the 16-inch M6 is confirmed; that's a naming decision.
- DEV-0238 / DEV-0241: Gemini proposes adding the Intel Retina models to the names ("MacBook Air 13" (Retina, 2018-2020 / M1)", "MacBook Pro 13" (Retina, 2016-2022 / M1 / M2)"). Same figures; a naming decision with RENAMED entries at integration. Recommended (people with an Intel Mac search for it).
- DEV-0005 (iPad Pro 10.5): figures confirmed by Gemini from Apple's spec page; ChatGPT's secondary link pointed at an iPad 6 review.

## New devices (21)
- Accept with confirmed figures: PROLED MacBook Pro 14" (14.2", 3024 x 1986) and 16" (16.3", 3472 x 2266): distinct screens, new rows.
- Group additions (same screen as an existing row): MacBook Pro 14" M6 → DEV-0239; iMac M6 → DEV-0264; Studio Display XDR, iMac 27" 5K, iMac Pro → DEV-0265; iPad mini 2/3 → DEV-0017; Intel Retina MacBook Air 2019/2020 → DEV-0238; MacBook Pro 13" M1 and Intel 2020 → DEV-0241; iMac 21.5" 2017 → DEV-0268 (generic 21.5" class; probably skip).
- Distinct older screens, figures agree in both passes: iPad mini 1st gen (1024 x 768), MacBook 12" (2304 x 1440), MacBook Pro 15" Retina (15.4", 2880 x 1800), MacBook Pro 16" Intel (16.0", 3072 x 1920), MacBook Air 13" non-Retina (1440 x 900), iMac 21.5" 4K (4096 x 2304).
