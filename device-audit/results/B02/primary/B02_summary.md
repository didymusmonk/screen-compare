# B02 primary pass (ChatGPT, complete version received 2026-11-27)

Part 1 (incomplete) is kept in part1/. ChatGPT's summary: 27/27 researched, all CONFIRMED, 0 numeric corrections, 2 splits (MacBook Pro 14"/16" PROLED XDR variants), 21 proposed additions (8 new screens, 13 group expansions).

Claude's check: files pass check_results.py with no errors or warnings. Concerns for the second pass:
- `evidence` cells are templated paraphrases ("Display specification: ... (full rectangle where specified)"), not quotes from the source, so they don't show what the page says. QC sample raised to 30%.
- Many rows cite only Apple's compare pages. DEV-0005 (iPad Pro 10.5) cites a Notebookcheck review of the iPad 6, a different device.
- Post-mid-2026 claims Claude can't confirm from its own knowledge: MacBook Pro PROLED XDR (3024 x 1986 at 14.2", 3472 x 2266 at 16.3"), MacBook Pro 14 M6, iMac M6, Studio Display (2026), Studio Display XDR, MacBook Neo, M5 Air.
- Several additions have no official PPI and cite only apple.com/mac/compare.
