#!/usr/bin/env python3
"""Makes a repaired copy of a returned results file, fixing only mechanical CSV slips that have one safe reading.

Usage: python3 device-audit/tools/repair_csv.py <returned.csv> <repaired.csv>

Repairs (each one is reported):
  1. A row with extra cells because the LAST column (notes or suggested_next_step) contained unquoted commas:
     the extra cells are joined back into that last column.
  2. A missing_devices row with exactly the 29 cells of the master instructions' layout plus calculated_ppi and
     geometry_basis (i.e. without color_width_px and color_height_px): two empty cells are inserted after color_ppi.
  3. original_* cells that differ from the baseline only in number formatting (14.60 vs 14.6) are restored.
Anything else is left alone for check_results.py to report. The returned file itself is never changed.
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.dirname(HERE)
SCHEMA = json.load(open(os.path.join(HERE, "schema.json")))
LEDGER = {r["audit_id"]: r for r in csv.DictReader(open(os.path.join(AUDIT, "COVERAGE_LEDGER.csv"), encoding="utf-8"))}

def main(src, dst):
    rows = list(csv.reader(open(src, encoding="utf-8-sig", newline="")))
    head, body = rows[0], rows[1:]
    kind = next((k for k, c in SCHEMA.items() if c == head), None)
    if not kind: print("header doesn't match a template; nothing repaired"); return 1
    n, out, fixes = len(head), [head], []
    for i, r in enumerate(body, start=2):
        if not any(c.strip() for c in r): continue
        if len(r) > n:
            fixes.append(f"line {i} ({r[0]}): joined {len(r) - n + 1} cells back into {head[-1]}")
            r = r[:n - 1] + [", ".join(c.strip() for c in r[n - 1:])]
        elif kind == "missing_devices" and len(r) == n - 2:
            k = head.index("color_ppi") + 1
            fixes.append(f"line {i} ({r[0]}): inserted empty color_width_px and color_height_px")
            r = r[:k] + ["", ""] + r[k:]
        if kind == "verification_results" and len(r) == n and r[0] in LEDGER:
            L = LEDGER[r[0]]
            for col, lc in (("original_diagonal", "diagonal"), ("original_width_px", "width"), ("original_height_px", "height")):
                j = head.index(col)
                try:
                    if r[j] != L[lc] and float(r[j]) == float(L[lc]):
                        fixes.append(f"line {i} ({r[0]}): {col} {r[j]!r} restored to {L[lc]!r}"); r[j] = L[lc]
                except ValueError: pass
        out.append(r)
    with open(dst, "w", newline="", encoding="utf-8") as f: csv.writer(f, lineterminator="\n").writerows(out)
    print(f"{len(fixes)} repairs -> {dst}"); [print("  " + x) for x in fixes]
    return 0

if __name__ == "__main__":
    if len(sys.argv) != 3: print(__doc__); sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2]))
