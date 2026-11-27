#!/usr/bin/env python3
"""Checks research files returned by ChatGPT, Gemini or Claude before they are merged. It never edits anything.

Usage (from the repo root):
  python3 device-audit/tools/check_results.py results/B03_verification_results.csv results/B03_missing_devices.csv ...
  python3 device-audit/tools/check_results.py --coverage     # checks every file in device-audit/results/ and lists uncovered rows

The file kind is recognised from its header (verification_results, missing_devices or unresolved_issues).
Reports: wrong columns, values outside the fixed lists, IDs not in the ledger, "original_*" cells that differ from the
frozen baseline (a sign a row was edited or invented), original rows missing from a batch, actions without the fields
they need, claims without a source, numbers that aren't numbers, and calculated PPI that doesn't match the figures given.
"""
import csv, glob, json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.dirname(HERE)
SCHEMA = json.load(open(os.path.join(HERE, "schema.json")))
LEDGER = {r["audit_id"]: r for r in csv.DictReader(open(os.path.join(AUDIT, "COVERAGE_LEDGER.csv"), encoding="utf-8"))}

V_STATUS = {"CONFIRMED", "CORROBORATED", "PARTIAL", "ESTIMATED", "RUMORED", "UNVERIFIED"}
P_STATUS = {"RELEASED", "ANNOUNCED", "RUMORED", "DISCONTINUED", "CANCELLED", "UNKNOWN"}
CATS = {"phone", "tablet", "ereader", "tablet pc", "laptop", "monitor", "paper"}
COMMON = {
    "researcher": {"chatgpt", "gemini", "claude"},
    "screen_role": {"single", "inner", "cover", "one_of_two", "unfolded", ""},
    "geometry_basis": {"MAKER_DIAGONAL", "MAKER_ACTIVE_AREA", "PPI_IMPLIED", "INDEPENDENT_MEASURED", "STANDARD", "NOMINAL_ONLY", ""},
}
CHOICES = {
    "verification_results": dict(COMMON, **{
        "pass": {"primary", "second_pass", "adjudication"},
        "verification_status": V_STATUS, "product_status": P_STATUS | {""},
        "action": {"KEEP", "CORRECT", "SPLIT", "MERGE", "FLAG_FOR_REVIEW"},
        "change_class": {"none", "minor", "material"},
        "verified_category": CATS | {""},
    }),
    "missing_devices": dict(COMMON, **{
        "verification_status": V_STATUS - {"UNVERIFIED"}, "product_status": P_STATUS,
        "inclusion_priority": {"essential", "useful", "optional", "review_queue"},
        "category": CATS,
    }),
    "unresolved_issues": dict(COMMON, **{
        "issue_type": {"SOURCE_CONFLICT", "PPI_MISMATCH", "GEOMETRY_UNCERTAIN", "GROUPING", "NAMING", "CATEGORY", "RELEASE_STATUS",
                       "CONFIGURABLE_PANEL", "COLOR_EINK", "FOLDABLE", "REGIONAL_VARIANT", "POSSIBLE_DUPLICATE", "SOURCE_UNAVAILABLE", "OTHER"},
    }),
}
NUMERIC = {"original_diagonal", "nominal_diagonal", "verified_diagonal", "verified_width_px", "verified_height_px", "official_ppi", "color_ppi",
           "color_width_px", "color_height_px", "active_width_mm", "active_height_mm", "calculated_ppi", "width_px", "height_px", "release_year"}

def f(s):
    try: return float(s)
    except (TypeError, ValueError): return None

def kind_of(head):
    for k, cols in SCHEMA.items():
        if head == cols: return k, []
    best = max(SCHEMA, key=lambda k: len(set(head) & set(SCHEMA[k])))
    cols = SCHEMA[best]
    return best, [f"columns differ from templates/{best}_header.csv (missing: {[c for c in cols if c not in head] or '-'}; "
                  f"extra: {[c for c in head if c not in cols] or '-'}; the order must match too)"]

def ppi_check(r, w, h, d, at, warns):
    W, H, D, P = f(r.get(w)), f(r.get(h)), f(r.get(d)), f(r.get("calculated_ppi"))
    if W and H and D and P and abs(math.hypot(W, H) / D - P) > 1.5:
        warns.append(f"{at}: calculated_ppi {P} doesn't match {W:g} x {H:g} at {D:g} in ({math.hypot(W, H) / D:.1f})")
    O = f(r.get("official_ppi"))
    if W and H and D and O and abs(math.hypot(W, H) / D - O) / O > 0.02:
        warns.append(f"{at}: official_ppi {O:g} differs from the calculated {math.hypot(W, H) / D:.1f} by more than 2% (needs a second pass)")

def check(path):
    errs, warns = [], []
    with open(path, encoding="utf-8-sig", newline="") as fh:
        rd = csv.reader(fh); head = next(rd, [])
        kind, e = kind_of(head); errs += e
        if e and set(SCHEMA[kind]) - set(head): return kind, errs, warns, []
        rows = []
        for n, r in enumerate(rd, start=2):
            if not any(c.strip() for c in r): continue
            if len(r) != len(head):
                errs.append(f"line {n} ({r[0] if r else '?'}): has {len(r)} cells but the header has {len(head)}, so later values sit in the wrong columns")
                rows.append(dict(zip(head, (r + [""] * len(head))[:len(head)]), _misaligned=True)); continue
            rows.append(dict(zip(head, r)))
    for i, r in enumerate(rows, start=2):
        rid = r.get("original_id") or r.get("new_id") or r.get("issue_id") or "?"
        at = f"line {i} ({rid})"
        if r.pop("_misaligned", False): continue  # already reported; its cells can't be trusted
        if r.get("researcher") and r["researcher"] != r["researcher"].lower() and r["researcher"].lower() in COMMON["researcher"]:
            warns.append(f"{at}: researcher {r['researcher']!r} should be lower case; read as {r['researcher'].lower()!r}")
            r["researcher"] = r["researcher"].lower()
        for k, ok in CHOICES[kind].items():
            if k in r and r[k] not in ok: errs.append(f"{at}: {k} = {r[k]!r} is not one of {sorted(x for x in ok if x)}")
        for k in NUMERIC & r.keys():
            if r[k] and f(r[k]) is None: errs.append(f"{at}: {k} must be a plain number, not {r[k]!r}")
        for k in ("primary_source_url", "secondary_source_url"):
            if r.get(k) and not re.match(r"https?://\S+$", r[k]): errs.append(f"{at}: {k} isn't a single web address")
        if r.get("verified_date") and not re.fullmatch(r"\d{4}-\d\d-\d\d", r["verified_date"]): errs.append(f"{at}: verified_date must be YYYY-MM-DD")

        if kind == "verification_results":
            L = LEDGER.get(r["original_id"])
            if not L: errs.append(f"{at}: original_id isn't in COVERAGE_LEDGER.csv (new devices go in missing_devices.csv)"); continue
            for c, lc in (("original_name", "name"), ("original_type", "type"), ("original_diagonal", "diagonal"),
                          ("original_width_px", "width"), ("original_height_px", "height")):
                if r[c] != L[lc]: errs.append(f"{at}: {c} is {r[c]!r} but the baseline says {L[lc]!r} (never edit original_* cells)")
            st, act = r["verification_status"], r["action"]
            if st in ("CONFIRMED", "CORROBORATED", "PARTIAL") and not r["primary_source_url"] and not r["secondary_source_url"]:
                errs.append(f"{at}: {st} needs a source URL")
            if st == "CONFIRMED" and not r["primary_source_url"]: errs.append(f"{at}: CONFIRMED needs primary_source_url (a manufacturer source)")
            if (r["primary_source_url"] or r["secondary_source_url"]) and not r["evidence"]: warns.append(f"{at}: evidence is empty")
            if act == "KEEP" and L["type"] != "paper" and r["verified_width_px"]:
                same = f(r["verified_diagonal"]) == f(L["diagonal"]) and sorted([f(r["verified_width_px"]), f(r["verified_height_px"])]) == sorted([f(L["width"]), f(L["height"])])
                if not same: errs.append(f"{at}: KEEP, but the verified figures differ from the original ones (use CORRECT or FLAG_FOR_REVIEW)")
            if act == "CORRECT" and not any(r[c] for c in ("verified_name", "verified_category", "verified_diagonal", "verified_width_px")):
                errs.append(f"{at}: CORRECT needs the verified values that change")
            if act in ("SPLIT", "MERGE") and not r["notes"]: errs.append(f"{at}: {act} needs notes naming the new rows or the target row")
            if act in ("CORRECT", "SPLIT", "MERGE") and r["change_class"] == "material" and not r["second_pass_reasons"]:
                warns.append(f"{at}: a material change should list second_pass_reasons (at least 'material change')")
            if st == "UNVERIFIED" and act == "KEEP": warns.append(f"{at}: KEEP while still UNVERIFIED; use FLAG_FOR_REVIEW if research couldn't finish")
            ppi_check(r, "verified_width_px", "verified_height_px", "verified_diagonal", at, warns)
        elif kind == "missing_devices":
            if not re.fullmatch(r"NEW-B\d\d-\d\d", r["new_id"]): errs.append(f"{at}: new_id must look like NEW-B10-01")
            if r["product_status"] in ("RUMORED", "ANNOUNCED") and r["inclusion_priority"] != "review_queue":
                errs.append(f"{at}: unreleased devices go in the review queue (inclusion_priority = review_queue)")
            if not r["primary_source_url"] and not r["secondary_source_url"]: errs.append(f"{at}: a proposed device needs a source URL")
            ee = r["existing_equivalent"]
            for tok in re.findall(r"DEV-\d{4}", ee):
                if tok not in LEDGER: errs.append(f"{at}: existing_equivalent names {tok}, which isn't in the ledger")
            if not ee: warns.append(f"{at}: existing_equivalent is empty (write 'none' after checking for duplicates)")
            ppi_check(r, "width_px", "height_px", "verified_diagonal", at, warns)
        else:
            rel = r["related_id"]
            if rel and not (rel in LEDGER or re.fullmatch(r"NEW-B\d\d-\d\d", rel)): errs.append(f"{at}: related_id must be a DEV- or NEW- ID")
            if not r["explanation"]: errs.append(f"{at}: explanation is empty")
    if kind == "verification_results" and any(r.get("pass") == "primary" for r in rows):
        for b in {r["batch_id"] for r in rows}:
            want = {a for a, L in LEDGER.items() if L["batch_id"] == b}
            miss = sorted(want - {r["original_id"] for r in rows if r["batch_id"] == b})
            if miss: errs.append(f"batch {b}: {len(miss)} original rows not answered: {', '.join(miss[:12])}{' ...' if len(miss) > 12 else ''}")
    return kind, errs, warns, rows

def main(argv):
    args = argv[1:]
    if not args or any(a in ("-h", "--help") for a in args): print(__doc__); return 0
    coverage = "--coverage" in args
    files = [a for a in args if a != "--coverage"] or (sorted(glob.glob(os.path.join(AUDIT, "results", "**", "*.csv"), recursive=True)) if coverage else [])
    if not files: print(__doc__); return 1
    bad, answered = 0, set()
    for p in files:
        kind, errs, warns, rows = check(p)
        if kind == "verification_results": answered |= {r["original_id"] for r in rows if r.get("pass") == "primary"}
        print(f"\n== {p} [{kind}]: {len(rows)} rows, {len(errs)} errors, {len(warns)} warnings")
        for e in errs: print("  ERROR", e)
        for w in warns[:50]: print("  warn ", w)
        bad += bool(errs)
    if coverage:
        left = [a for a in LEDGER if a not in answered]
        print(f"\nCoverage: {len(LEDGER) - len(left)} of {len(LEDGER)} original rows have a primary answer.")
        by = {}
        for a in left: by.setdefault(LEDGER[a]["batch_id"], []).append(a)
        for b in sorted(by): print(f"  {b}: {len(by[b])} still open")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
