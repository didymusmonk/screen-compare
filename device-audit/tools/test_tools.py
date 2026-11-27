#!/usr/bin/env python3
"""Self-test for validate_db.py and build_proposal.py's rules: each planted fault must be caught.
Usage (from the repo root): python3 device-audit/tools/test_tools.py"""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate_db
from dblib import BASELINE

BAD = '''name,type,diagonal,width,height
Galaxy S26+,phone,6.7,3120,1440
Galaxy S26 plus,phone,6.7,3120,1440
Phone X,phone,6.1,2532,1170
Phone X,phone,6.1,2532,1170
Tiny Tab,tablet,,2000,1200
Odd Thing,gadget,10,1000,800
Wide One,monitor,30,5000,1000
Dense,phone,2,2532,1170
Fake Fold7 (inner),phone,8.0,2184,1968
Fake Flip9,phone,6.9,2520,1080
Boox Color Thing C,ereader,7.8,936,702
iPad Mega,phone,13,2732,2048
Galaxy Z Fold9 / Fold8 (inner),phone,7.6,2448,1848
Galaxy Z Fold8 (inner),phone,8.0,2504,2256
A4 paper,paper,,8.268,11.693
Bad paper,paper,5,8,11
'''
EXPECT = [("ERROR", "duplicate ID"), ("ERROR", "duplicate"), ("ERROR", "dimensions"), ("ERROR", "category"), ("ERROR", "shape"),
          ("ERROR", "PPI range"), ("WARN", "foldable"), ("WARN", "colour e-ink"), ("WARN", "category"), ("WARN", "grouping"),
          ("ERROR", "compatibility")]

def main():
    fails = 0
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "bad.csv")
        open(p, "w").write(BAD)
        rows, F = validate_db.run(p, BASELINE)
        got = {(i["severity"], i["check"]) for i in F.items}
        for e in EXPECT:
            ok = e in got
            fails += not ok
            print("%s %s" % ("ok  " if ok else "FAIL", e))
        fold = [i for i in F.items if i["check"] == "foldable"]
        for want in ("fake fold7", "fake flip9"):
            ok = any(want in i["detail"] for i in fold)
            fails += not ok
            print("%s foldable finding for %s" % ("ok  " if ok else "FAIL", want))
        ok = any("old ID" in i["detail"] for i in F.items)
        fails += not ok
        print("%s missing old IDs are reported" % ("ok  " if ok else "FAIL"))
    rows, F = validate_db.run(BASELINE, BASELINE)
    errs = [i for i in F.items if i["severity"] == "ERROR"]
    fails += bool(errs)
    print("%s the original list has no errors (%d)" % ("ok  " if not errs else "FAIL", len(errs)))
    print("\n%d failed" % fails)
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
