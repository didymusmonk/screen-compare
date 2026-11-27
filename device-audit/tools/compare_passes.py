#!/usr/bin/env python3
"""Compares a batch's primary and second-pass results field by field. It never edits anything.

Usage (from the repo root):  python3 device-audit/tools/compare_passes.py B10
Writes device-audit/results/<B>/<B>_pass_comparison.csv and prints a summary. Figures are compared as numbers
(diagonal within 0.005 in, pixels exactly, long side first); statuses and actions are listed side by side.
"""
import csv, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.dirname(HERE)

def load(path, key):
    return {r[key]: r for r in csv.DictReader(open(path, encoding="utf-8-sig"))} if os.path.exists(path) else {}

def f(s):
    try: return float(s)
    except (TypeError, ValueError): return None

def geo(r, d, w, h):
    W, H = f(r.get(w)), f(r.get(h))
    return f(r.get(d)), (max(W, H) if W and H else None), (min(W, H) if W and H else None)

def main(b):
    base = os.path.join(AUDIT, "results", b)
    P = load(os.path.join(base, "primary", f"{b}_verification_results.csv"), "original_id")
    S = load(os.path.join(base, "second_pass", f"{b}_SP_verification_results.csv"), "original_id")
    PN = load(os.path.join(base, "primary", f"{b}_missing_devices.csv"), "new_id")
    SN = load(os.path.join(base, "second_pass", f"{b}_SP_missing_devices.csv"), "new_id")
    out, agree, differ = [], 0, 0
    def row(kind, i, name, p, s, d, w, h, act):
        nonlocal agree, differ
        gp, gs = geo(p, d, w, h), geo(s, d, w, h) if s else (None, None, None)
        same = s and gp[0] is not None and gs[0] is not None and abs(gp[0] - gs[0]) < 0.005 and gp[1:] == gs[1:]
        if not s: verdict = "NOT_CHECKED"
        elif same: verdict = "FIGURES_AGREE"
        else: verdict = "FIGURES_DIFFER"
        agree += verdict == "FIGURES_AGREE"; differ += verdict == "FIGURES_DIFFER"
        out.append({"id": i, "kind": kind, "name": name, "verdict": verdict,
                    "primary_figures": "%s in %s x %s" % gp, "second_figures": "%s in %s x %s" % gs if s else "",
                    "primary_status": p.get("verification_status", ""), "second_status": (s or {}).get("verification_status", ""),
                    "primary_action": p.get(act, ""), "second_action": (s or {}).get(act, ""),
                    "primary_source": p.get("primary_source_url", ""), "second_source": (s or {}).get("primary_source_url", ""),
                    "second_notes": (s or {}).get("notes", "")})
    for i, p in P.items():
        if i in S: row("existing", i, p["original_name"], p, S[i], "verified_diagonal", "verified_width_px", "verified_height_px", "action")
    for i, p in PN.items():
        row("new", i, p["device_name"], p, SN.get(i), "verified_diagonal", "width_px", "height_px", "inclusion_priority")
    path = os.path.join(base, f"{b}_pass_comparison.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()), lineterminator="\n"); w.writeheader(); w.writerows(out)
    print(f"{b}: {len(out)} compared, {agree} figures agree, {differ} differ, {sum(o['verdict'] == 'NOT_CHECKED' for o in out)} not checked -> {path}")
    for o in out:
        if o["verdict"] != "FIGURES_AGREE": print(" ", o["id"], o["name"], o["verdict"], o["primary_figures"], "|", o["second_figures"])
    return 0

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"): print(__doc__); sys.exit(0)
    sys.exit(main(sys.argv[1]))
