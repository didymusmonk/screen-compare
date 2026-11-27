#!/usr/bin/env python3
"""Builds the blind second-pass files for one batch from its primary results.

Usage (from the repo root):
  python3 device-audit/tools/make_second_pass.py B02 [--qc 0.10]

Selects (BATCH_MANIFEST.md section 4):
  - every row whose action isn't KEEP, whose status isn't CONFIRMED/CORROBORATED, whose product isn't RELEASED/DISCONTINUED,
    that lists second_pass_reasons, or that the ledger flags RELEASE_CHECK
  - a seeded random quality-control sample of the remaining rows (default 10%, at least 2), spread across types
  - every proposed new device
Writes to device-audit/results/<B>/second_pass/:
  <B>_SP_verification_results.csv   original values only, pass=second_pass, researcher=the other model
  <B>_SP_new_devices_to_check.csv   new_id, device name and variant only (no figures)
  <B>_SP_selection.csv              why each row was picked (for Claude; don't give it to the verifier)
"""
import csv, json, os, random, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.dirname(HERE)
SCHEMA = json.load(open(os.path.join(HERE, "schema.json")))
LEDGER = {r["audit_id"]: r for r in csv.DictReader(open(os.path.join(AUDIT, "COVERAGE_LEDGER.csv"), encoding="utf-8"))}

def main(b, qc):
    src = os.path.join(AUDIT, "results", b, "primary")
    ver = list(csv.DictReader(open(os.path.join(src, f"{b}_verification_results.csv"), encoding="utf-8-sig")))
    new_path = os.path.join(src, f"{b}_missing_devices.csv")
    new = list(csv.DictReader(open(new_path, encoding="utf-8-sig"))) if os.path.exists(new_path) else []
    primary = ver[0]["researcher"].lower()
    other = {"chatgpt": "gemini", "gemini": "chatgpt"}.get(primary, "claude")
    picked, why = [], {}
    for r in ver:
        L = LEDGER[r["original_id"]]; rs = []
        if r["action"] != "KEEP": rs.append("action " + r["action"])
        if r["verification_status"] not in ("CONFIRMED", "CORROBORATED"): rs.append("status " + r["verification_status"])
        if r["product_status"] not in ("RELEASED", "DISCONTINUED"): rs.append("product " + (r["product_status"] or "blank"))
        if r["second_pass_reasons"]: rs.append("reasons: " + r["second_pass_reasons"])
        if "RELEASE_CHECK" in L["structure_flags"]: rs.append("ledger RELEASE_CHECK")
        if rs: picked.append(r["original_id"]); why[r["original_id"]] = "; ".join(rs)
    rest = [r for r in ver if r["original_id"] not in why]
    rnd = random.Random(zlib.crc32(b.encode()))  # recorded seed: the batch ID
    n = max(2, round(len(rest) * qc)) if rest else 0
    by_type = {}
    for r in rest: by_type.setdefault(r["original_type"], []).append(r)
    sample = []
    while len(sample) < min(n, len(rest)):  # round-robin over types so each type is represented
        for t in sorted(by_type):
            pool = [r for r in by_type[t] if r not in sample]
            if pool and len(sample) < n: sample.append(rnd.choice(pool))
    for r in sample: picked.append(r["original_id"]); why[r["original_id"]] = f"quality-control sample (seed crc32('{b}'))"
    out = os.path.join(AUDIT, "results", b, "second_pass"); os.makedirs(out, exist_ok=True)
    order = [r["original_id"] for r in ver if r["original_id"] in why]
    with open(os.path.join(out, f"{b}_SP_verification_results.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=SCHEMA["verification_results"], lineterminator="\n"); w.writeheader()
        for a in order:
            L = LEDGER[a]
            w.writerow({"original_id": a, "batch_id": b, "researcher": other, "pass": "second_pass", "original_name": L["name"],
                        "original_type": L["type"], "original_diagonal": L["diagonal"], "original_width_px": L["width"],
                        "original_height_px": L["height"], "verification_status": "UNVERIFIED"})
    with open(os.path.join(out, f"{b}_SP_new_devices_to_check.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n"); w.writerow(["new_id", "manufacturer", "device_name", "display_variant", "category"])
        for r in new: w.writerow([r["new_id"], r["manufacturer"], r["device_name"], r["display_variant"], r["category"]])
    with open(os.path.join(out, f"{b}_SP_selection.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n"); w.writerow(["original_id", "name", "why_selected"])
        for a in order: w.writerow([a, LEDGER[a]["name"], why[a]])
        for r in new: w.writerow([r["new_id"], r["device_name"], "proposed new device"])
    print(f"{b}: {len(order)} of {len(ver)} rows ({len(order) - len(sample)} triggered, {len(sample)} QC sample) + {len(new)} new devices -> {other}")
    return 0

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"): print(__doc__); sys.exit(0)
    qc = float(a[a.index("--qc") + 1]) if "--qc" in a else 0.10
    sys.exit(main(a[0], qc))
