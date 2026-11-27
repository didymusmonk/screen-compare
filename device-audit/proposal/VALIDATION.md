# Validation report

File: `device-audit/proposal/devices_verified.csv`: 375 rows (345 screens, 30 paper sizes).
Result: **0 errors, 5 warnings, 66 notes.** Errors would break the site or its tests; warnings need a look; notes are grouping ideas and other information.

## Warnings

**category** (2)

- DEV-0223 `Surface Duo 2 (one screen)`: name suggests phone but type is tablet pc
- DEV-0224 `Surface Duo (one screen)`: name suggests phone but type is tablet pc

**foldable** (1)

- NEW-B08-03 `Galaxy Z Fold2 (cover)`: 'galaxy z fold2' has a cover row but no main (inner) screen row

**PPI vs maker** (1)

- NEW-B08-05 `Galaxy Z Flip / Flip 5G (cover)`: maker says 303 ppi, the diagonal and pixels give 291.1 (3.9% apart)

**size vs active area** (1)

- DEV-0277 `29" ultrawide 1080p monitor`: maker's active area is 26.49 x 11.17 in, the row draws 26.72 x 11.27 in (0.9% apart)

## Notes

**ambiguous name** (13)

- DEV-0004 `iPad Pro 11-inch (1st to 4th gen)`: different screens whose names differ only inside brackets: iPad Pro 11-inch (M4/M5); iPad Pro 11-inch (1st to 4th gen)
- DEV-0010 `iPad Air (3rd gen)`: different screens whose names differ only inside brackets: iPad Air (4th/5th gen); iPad Air (3rd gen)
- DEV-0014 `iPad (5th/6th gen)`: different screens whose names differ only inside brackets: iPad (7th/8th/9th gen); iPad (5th/6th gen)
- DEV-0017 `iPad mini (4th/5th gen)`: different screens whose names differ only inside brackets: iPad mini (A20 Pro, 2026); iPad mini (4th/5th gen); iPad mini (1st gen)
- DEV-0171 `Kindle Paperwhite (2015 to 2018)`: different screens whose names differ only inside brackets: Kindle Paperwhite (2021); Kindle Paperwhite (2015 to 2018)
- DEV-0221 `Surface Book 3 / Book 2 (15")`: different screens whose names differ only inside brackets: Surface Book 3 / Book 2 (13.5"); Surface Book 3 / Book 2 (15")
- DEV-0238 `MacBook Air 13" (M1)`: different screens whose names differ only inside brackets: MacBook Air 13" (M2 to M5); MacBook Air 13" (M1); MacBook Air 13" (2010 to 2017)
- NEW-B02-02 `MacBook Pro 14" (PROLED XDR)`: different screens whose names differ only inside brackets: MacBook Pro 14" (M1 to M5); MacBook Pro 14" (PROLED XDR)
- NEW-B02-03 `MacBook Pro 16" (PROLED XDR)`: different screens whose names differ only inside brackets: MacBook Pro 16" (M1 to M5); MacBook Pro 16" (PROLED XDR); MacBook Pro 16" (Intel, 2019)
- DEV-0246 `Surface Laptop 3 / 4 / 5 / 6 (15")`: different screens whose names differ only inside brackets: Surface Laptop 3 / 4 / 5 / 6 (13.5"); Surface Laptop 3 / 4 / 5 / 6 (15")
- NEW-B04-01 `Dell XPS 13 (9345)`: different screens whose names differ only inside brackets: Dell XPS 13 (9350); Dell XPS 13 (9345); Dell XPS 13 (9340)
- DEV-0259 `Framework Laptop 13 (2.2K)`: different screens whose names differ only inside brackets: Framework Laptop 13 (2.8K); Framework Laptop 13 (2.2K)
- NEW-B06-03 `32" 6K monitor`: different screens whose names differ only inside brackets: 32" 6K (Pro Display XDR) monitor; 32" 6K monitor

**same screen** (52)

- DEV-0003 `iPad Pro 12.9-inch (1st to 6th gen)`: same screen as iPad Air 13-inch (M2 to M4) (separate rows are fine when people search for each)
- DEV-0005 `iPad Pro 10.5-inch`: same screen as iPad Air (3rd gen) (separate rows are fine when people search for each)
- DEV-0006 `iPad Pro 9.7-inch`: same screen as iPad Air 2 / iPad Air; iPad (5th/6th gen) (separate rows are fine when people search for each)
- DEV-0008 `iPad Air 11-inch (M2 to M4)`: same screen as iPad Air (4th/5th gen); iPad (11th gen / A16) / iPad 10th gen (separate rows are fine when people search for each)
- DEV-0018 `Galaxy Tab S11 Ultra`: same screen as Galaxy Tab S10 Ultra; Galaxy Tab S9 Ultra; Galaxy Tab S8 Ultra (separate rows are fine when people search for each)
- DEV-0019 `Galaxy Tab S11`: same screen as Galaxy Tab S9; Galaxy Tab S8 / S7 (separate rows are fine when people search for each)
- DEV-0021 `Galaxy Tab S10+`: same screen as Galaxy Tab S9+; Galaxy Tab S8+ / S7+ (separate rows are fine when people search for each)
- DEV-0023 `Galaxy Tab S10 FE`: same screen as Galaxy Tab S9 FE (separate rows are fine when people search for each)
- DEV-0037 `Lenovo Tab P12 / Idea Tab Pro`: same screen as Lenovo Yoga Tab Plus (separate rows are fine when people search for each)
- DEV-0056 `iPhone 18 Pro Max`: same screen as iPhone 17 Pro Max; iPhone 16 Pro Max (separate rows are fine when people search for each)
- DEV-0057 `iPhone 18 Pro`: same screen as iPhone 17 Pro; iPhone 17; iPhone 16 Pro (separate rows are fine when people search for each)
- DEV-0058 `iPhone 17e`: same screen as iPhone 16e; iPhone 14; iPhone 13 Pro; iPhone 13; iPhone 12 Pro; iPhone 12 (separate rows are fine when people search for each)
- DEV-0065 `iPhone 16 Plus`: same screen as iPhone 15 Pro Max; iPhone 15 Plus; iPhone 14 Pro Max (separate rows are fine when people search for each)
- DEV-0066 `iPhone 16`: same screen as iPhone 15 Pro; iPhone 15; iPhone 14 Pro (separate rows are fine when people search for each)
- DEV-0074 `iPhone 14 Plus`: same screen as iPhone 13 Pro Max; iPhone 12 Pro Max (separate rows are fine when people search for each)
- DEV-0079 `iPhone 13 mini`: same screen as iPhone 12 mini (separate rows are fine when people search for each)
- DEV-0084 `iPhone 11 Pro Max`: same screen as iPhone XS Max (separate rows are fine when people search for each)
- DEV-0085 `iPhone 11 Pro`: same screen as iPhone XS / X (separate rows are fine when people search for each)
- DEV-0086 `iPhone 11`: same screen as iPhone XR (separate rows are fine when people search for each)
- DEV-0093 `Galaxy S26 Ultra`: same screen as Galaxy S25 Ultra (separate rows are fine when people search for each)
- DEV-0094 `Galaxy S26+`: same screen as Galaxy S25 Edge; Galaxy S25+; Galaxy S24+ (separate rows are fine when people search for each)
- DEV-0096 `Galaxy S26 FE`: same screen as Galaxy S25 FE; Galaxy S24 FE; Galaxy A56; Galaxy A16 (separate rows are fine when people search for each)
- DEV-0100 `Galaxy S25`: same screen as Galaxy S24 (separate rows are fine when people search for each)
- DEV-0106 `Galaxy S23 Ultra`: same screen as Galaxy S22 Ultra (separate rows are fine when people search for each)
- DEV-0107 `Galaxy S23+`: same screen as Galaxy S22+; Galaxy A55 / A35 (separate rows are fine when people search for each)
- DEV-0108 `Galaxy S23`: same screen as Galaxy S22 (separate rows are fine when people search for each)
- DEV-0109 `Galaxy S23 FE`: same screen as Galaxy S21 FE; Galaxy A54 (separate rows are fine when people search for each)
- DEV-0114 `Galaxy S21+`: same screen as Galaxy Note20 (separate rows are fine when people search for each)
- DEV-0120 `Galaxy Z TriFold (cover)`: same screen as Galaxy Z Fold8 Ultra (cover); Galaxy Z Fold7 (cover) (separate rows are fine when people search for each)
- DEV-0133 `Galaxy Z Flip8`: same screen as Galaxy Z Flip7 (separate rows are fine when people search for each)
- DEV-0134 `Galaxy Z Flip8 (cover)`: same screen as Galaxy Z Flip7 (cover) (separate rows are fine when people search for each)
- NEW-B07-03 `Galaxy A53 5G`: same screen as Galaxy S20 FE (separate rows are fine when people search for each)
- DEV-0145 `Pixel 10 Pro XL`: same screen as Pixel 9 Pro XL (separate rows are fine when people search for each)
- DEV-0148 `Pixel 9`: same screen as Pixel 9a; Pixel 9 Pro Fold (cover) (separate rows are fine when people search for each)
- DEV-0150 `Pixel 11 Pro Fold (inner)`: same screen as Pixel 10 Pro Fold (inner); Pixel 9 Pro Fold (inner) (separate rows are fine when people search for each)
- DEV-0168 `Kindle Colorsoft / Colorsoft 2`: same screen as Kindle Paperwhite 6 / 7 (2024/2026); Kindle Oasis (2017/2019) (separate rows are fine when people search for each)
- DEV-0171 `Kindle Paperwhite (2015 to 2018)`: same screen as Kindle (2022/2024/2026) / Kindle aluminum; Kindle Voyage (separate rows are fine when people search for each)
- DEV-0176 `Boox Note Max`: same screen as Boox Tab X C (separate rows are fine when people search for each)
- DEV-0179 `Boox Note Air6 C`: same screen as Boox Note Air5 C; Boox Note Air4 C; Boox Note Air3 C; Boox Go 10.3 / Go 10.3 (Gen II); Boox Go 10.3 (Gen II) Lumi; Boox Tab Ultra C Pro (separate rows are fine when people search for each)
- DEV-0183 `Boox Note Air3`: same screen as Boox Tab Ultra; Boox Note5 (separate rows are fine when people search for each)
- DEV-0191 `Boox Go 7 / Go Color 7 (incl. Gen II)`: same screen as Boox Page; Boox Leaf 3C (separate rows are fine when people search for each)
- DEV-0195 `Boox Palma 3`: same screen as Boox Palma / Palma 2 / Palma 2 Pro (separate rows are fine when people search for each)
- DEV-0199 `Kobo Libra Colour`: same screen as Kobo Libra 2 (separate rows are fine when people search for each)
- NEW-B05-01 `Kobo Clara BW`: same screen as Kobo Clara Colour (separate rows are fine when people search for each)
- DEV-0203 `Surface Pro 11th Edition (13")`: same screen as Surface Pro 10 for Business; Surface Pro 9; Surface Pro 8; Surface Pro X (separate rows are fine when people search for each)
- DEV-0208 `Surface Pro 7 / 7+`: same screen as Surface Pro 6; Surface Pro (2017) / Pro 5; Surface Pro 4 (separate rows are fine when people search for each)
- DEV-0213 `Surface Pro 2 / Pro (1st gen)`: same screen as Surface 2 (separate rows are fine when people search for each)
- DEV-0220 `Surface Book 3 / Book 2 (13.5")`: same screen as Surface Book (1st gen) / Book with Performance Base (separate rows are fine when people search for each)
- DEV-0238 `MacBook Air 13" (M1)`: same screen as MacBook Pro 13" (M2) (separate rows are fine when people search for each)
- DEV-0244 `Surface Laptop 7th Edition 15"`: same screen as Surface Laptop 3 / 4 / 5 / 6 (15") (separate rows are fine when people search for each)
- DEV-0245 `Surface Laptop 3 / 4 / 5 / 6 (13.5")`: same screen as Surface Laptop / Laptop 2 (separate rows are fine when people search for each)
- DEV-0265 `27" 5K (Apple Studio Display) monitor`: same screen as 27" 5K monitor (separate rows are fine when people search for each)

**colour e-ink** (1)

- DEV-0201 `reMarkable Paper Pro`: colour at full resolution (229 ppi), as Gallery 3 panels do

