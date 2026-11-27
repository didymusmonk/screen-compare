#!/usr/bin/env python3
"""Builds the combined Gemini assignment files from the original batch files. Safe to re-run (it only writes assignments/).

Usage (from the repo root):  python3 device-audit/tools/make_assignments.py

Each assignments/G<n>_verification_results.csv has the usual verification_results columns, one row per original row in
its batches, with researcher = gemini. The 'notes' cell is pre-filled with "PREP: ..." (the ledger's structure flags and
preparation notes) so Gemini needs only this one file; Gemini replaces it with its own note.
Rows keep their original batch_id (B01, B09 ...), so check_results.py and the ledger keep working unchanged.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dblib import AUDIT, header, ledger, read_csv, write_csv

GROUPS = {  # order = suggested research order (Apple, e-readers, then the rest)
    "G1": ("Phones except Samsung: iPhone, Google Pixel, OnePlus, Oppo, Xiaomi, iPhone Duo", ["B01", "B09"]),
    "G2": ("E-readers: Kindle, Kobo, reMarkable, Boox", ["B05", "B11"]),
    "G3": ("Samsung Galaxy phones, including foldables", ["B07", "B08"]),
    "G4": ("Windows PCs: Microsoft Surface, Lenovo, Dell, HP, ASUS, Framework", ["B03", "B04"]),
}

def main():
    L = ledger()
    H = header("verification_results_header.csv")
    os.makedirs(os.path.join(AUDIT, "assignments"), exist_ok=True)
    for g, (title, batches) in GROUPS.items():
        rows = []
        for b in batches:
            for r in read_csv(os.path.join(AUDIT, "batches", "%s_verification_results.csv" % b)):
                led = L[r["original_id"]]
                r["researcher"] = "gemini"
                prep = "; ".join(x for x in (led["structure_flags"], led["prep_notes"]) if x)
                r["notes"] = ("PREP: " + prep) if prep else ""
                rows.append(r)
        write_csv(os.path.join(AUDIT, "assignments", "%s_verification_results.csv" % g), H, rows)
        print("%s  %-70s %s  %d rows" % (g, title, "+".join(batches), len(rows)))

if __name__ == "__main__":
    main()
