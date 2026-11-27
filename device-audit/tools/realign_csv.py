#!/usr/bin/env python3
"""Fixes rows where Gemini dropped or added an empty cell (or left an unquoted comma), using fixed anchor values to put
every cell back in its column. Writes a new file; the returned file is never changed. Run repair_csv.py afterwards.

Usage: python3 device-audit/tools/realign_csv.py <returned.csv> <realigned.csv>

How: geometry_basis (MAKER_DIAGONAL ...) must sit in its own column. If it is too early, empty cells are inserted among
the optional colour columns; if too late, empty cells there are removed. The cell just before it must be calculated_ppi.
After it, verification_status, the YYYY-MM-DD date and the fixed-value columns are found by value, and extra cells
in between (from unquoted commas) are joined back into the text column they came from. Each change is printed, and a
row that can't be fixed safely is left as it was for check_results.py to report.
"""
import csv, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = json.load(open(os.path.join(HERE, "schema.json")))
GB = {"MAKER_DIAGONAL", "MAKER_ACTIVE_AREA", "PPI_IMPLIED", "INDEPENDENT_MEASURED", "STANDARD", "NOMINAL_ONLY"}
VS = {"CONFIRMED", "CORROBORATED", "PARTIAL", "ESTIMATED", "RUMORED", "UNVERIFIED"}
DATE = re.compile(r"\d{4}-\d\d-\d\d$")
isnum = lambda c: re.fullmatch(r"-?\d+(\.\d+)?", c.strip() or "x") is not None


def fix_block(seg, n, text_at=None):
    """Make seg n cells long, adding/removing empty cells among the colour columns (positions 1-3)."""
    seg = list(seg)
    if text_at is not None:
        t = next((i for i, c in enumerate(seg) if c.strip() and not isnum(c)), None)
        if t is None:
            t = len(seg)
            seg.append("")
        before, after = seg[:t], seg[t + 1:]
        before = fix_block(before, text_at)
        if before is None:
            return None
        while len(after) < n - text_at - 1:
            after.append("")
        while len(after) > n - text_at - 1 and "" in after:
            after.remove("")
        out = before + [seg[t]] + after
        return out if len(out) == n else None
    while len(seg) < n:
        seg.insert(min(1, len(seg)), "")
    while len(seg) > n:
        empties = [i for i in range(1, len(seg)) if not seg[i].strip()]
        if not empties:
            return None
        del seg[empties[0]]
    return seg


SR = {"single", "inner", "cover", "one_of_two", "unfolded", ""}


def realign(row, head, kind):
    if kind == "verification_results" and row[13] not in SR:
        r = next((i for i in range(14, 20) if row[i] in SR - {""}), None)
        if r is None:
            return None, "can't find screen_role"
        row = row[:12] + [", ".join(row[12:r])] + row[r:]  # unquoted commas in models_covered
    if kind == "verification_results":
        g_exp, blk_start, blk_len, text_at = 27, 19, 7, 4
    else:
        g_exp, blk_start, blk_len, text_at = 20, 13, 6, None
    g = next((i for i in range(blk_start, len(row)) if row[i] in GB), None)
    if g is None:
        return None, "no geometry_basis value found"
    seg = fix_block(row[blk_start:g - 1], blk_len, text_at)
    if seg is None:
        return None, "can't rebuild the PPI/colour block"
    calc = row[g - 1]
    tail = row[g:]
    if kind == "verification_results":
        # geo, panel_options, vstatus, pstatus, url1, url2, evidence, date, action, change, reasons, notes
        v = next((i for i in range(1, len(tail)) if tail[i] in VS), None)
        d = next((i for i in range((v or 0) + 4, len(tail)) if DATE.match(tail[i])), None)
        if v is None or d is None or d < v + 4:
            return None, "can't find verification_status and date"
        panel = ", ".join(tail[1:v])
        ev = ", ".join(tail[v + 4:d])
        rest = tail[d + 1:]
        if len(rest) < 4:
            rest += [""] * (4 - len(rest))
        new_tail = [tail[0], panel, tail[v], tail[v + 1], tail[v + 2], tail[v + 3], ev, tail[d]] + rest[:3] + [", ".join(rest[3:])]
    else:
        # geo, vstatus, pstatus, url1, url2, evidence, date, priority, existing, reason, notes
        d = next((i for i in range(5, len(tail)) if DATE.match(tail[i])), None)
        if d is None:
            return None, "can't find the date"
        ev = ", ".join(tail[5:d])
        rest = tail[d + 1:]
        if len(rest) < 4:
            rest += [""] * (4 - len(rest))
        new_tail = tail[:5] + [ev, tail[d]] + rest[:3] + [", ".join(rest[3:])]
    out = row[:blk_start] + seg + [calc] + new_tail
    return (out, "ok") if len(out) == len(head) else (None, "length still %d" % len(out))


def main(src, dst):
    rows = list(csv.reader(open(src, encoding="utf-8-sig", newline="")))
    head = rows[0]
    kind = next((k for k, v in SCHEMA.items() if v == head), None)
    if kind not in ("verification_results", "missing_devices"):
        print("%s: header not recognised or not a fixable kind; copied unchanged" % src)
        kind = None
    out = [head]
    for r in rows[1:]:
        if kind and r and (len(r) != len(head) or (kind == "verification_results" and r[13] not in SR)) or (kind and r and len(r) == len(head) and r[27 if kind == "verification_results" else 20] not in GB | {""}):
            new, why = realign(r, head, kind)
            if new:
                print("  %s: realigned (%d -> %d cells)" % (r[0], len(r), len(new)))
                r = new
            else:
                print("  %s: NOT fixed (%s)" % (r[0], why))
        out.append(r)
    with open(dst, "w", encoding="utf-8", newline="") as fh:
        csv.writer(fh, lineterminator="\n").writerows(out)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
