#!/usr/bin/env python3
"""Builds COVERAGE_LEDGER.csv and the per-batch research templates from devices_original.csv.

Run from the repo root:  python3 device-audit/tools/build_ledger.py
It only reads devices_original.csv (the frozen baseline) and index.html/tests (for flags), and only writes
inside device-audit/. Re-running it gives the same audit IDs, because they follow the baseline's row order.
Don't re-run it after research has started unless you mean to reset the ledger's status columns.
"""
import csv, glob, hashlib, math, os, re, json

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.dirname(HERE)
ROOT = os.path.dirname(AUDIT)
BASE = os.path.join(AUDIT, "devices_original.csv")

def slug(s):  # same as index.html: "+" counts as "plus"
    s = s.lower().replace("+", " plus ")
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s))

# ---- read the baseline, keeping the physical line number of every row ----
rows = []
with open(BASE, encoding="utf-8") as f:
    lines = f.read().split("\n")
header_seen = False
for i, line in enumerate(lines, start=1):
    if not line.strip() or line.startswith("#"):
        continue
    cells = next(csv.reader([line]))
    if not header_seen:
        header_seen = True
        continue
    rows.append((i, [c.strip() for c in cells]))

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
renamed = json.loads(re.search(r"const RENAMED = (\{.*?\});", html).group(1))
old_paper = dict(re.findall(r'(\w+): "([a-z0-9-]+)"', re.search(r"const OLD_PAPER_IDS = \{(.*?)\};", html, re.S).group(1)))
defaults = set(re.findall(r'\{ id: "([a-z0-9-]+)", uid: "d\d" \}', html)) | {"us-letter-paper"}
alias_of = {}
for old, new in list(renamed.items()) + [(k, v) for k, v in old_paper.items()]:
    alias_of.setdefault(new, []).append(old)
tests = "".join(open(p, encoding="utf-8").read() for p in glob.glob(os.path.join(ROOT, "tests", "*.js")) + [os.path.join(ROOT, "tests", "browser-check.html")])

# ---- batches: (id, owner, title, test) in priority order; the first test that matches wins ----
def has(n, *words): return any(w in n for w in words)
FOLD = lambda n: has(n, "(inner)", "(cover)", "(front)", "Galaxy Z Flip")
BATCHES = [
    ("B09", "gemini",  "Google, OnePlus, Oppo and Xiaomi phones, plus Apple's foldable", lambda n, t: t == "phone" and not n.startswith("Galaxy") and (not n.startswith("iPhone") or FOLD(n))),
    ("B08", "gemini",  "Samsung foldable phones",                         lambda n, t: t == "phone" and FOLD(n)),
    ("B01", "chatgpt", "iPhone",                                         lambda n, t: n.startswith("iPhone")),
    ("B02", "chatgpt", "iPad, Mac and Apple displays",                   lambda n, t: n.startswith("iPad") or has(n, "MacBook", "iMac", "Apple Studio Display", "Pro Display XDR")),
    ("B03", "chatgpt", "Microsoft Surface",                              lambda n, t: n.startswith("Surface")),
    ("B06", "chatgpt", "Generic monitors and typical laptops",           lambda n, t: t == "monitor" or n.startswith("Typical")),
    ("B04", "chatgpt", "Other Windows 2-in-1s and laptops",              lambda n, t: t in ("tablet pc", "laptop")),
    ("B05", "chatgpt", "Kindle, Kobo, reMarkable and other non-Boox e-readers", lambda n, t: t == "ereader" and not n.startswith("Boox")),
    ("B11", "gemini",  "Boox e-readers",                                 lambda n, t: t == "ereader"),
    ("B07", "gemini",  "Samsung Galaxy phones (not foldable)",           lambda n, t: t == "phone"),
    ("B10", "gemini",  "Android tablets (Samsung, Lenovo, Google, Amazon, OnePlus)", lambda n, t: t == "tablet"),
    ("B12", "claude",  "Paper, book and card sizes (published standards)", lambda n, t: t == "paper"),
]
# shown in batch-number order in the manifest
BATCH_ORDER = sorted(BATCHES, key=lambda b: b[0])

# Rows whose release (or exact shipping specs) Claude couldn't confirm from its own knowledge (to mid-2026).
# This is NOT a claim that they are wrong; it means "prove it exists and is on sale before trusting the numbers".
RELEASE_CHECK = [
    "iPhone Duo", "iPhone 18 Pro", "iPhone 17e", "Galaxy S26 FE", "Galaxy Z Fold8", "Galaxy Z Flip8", "Galaxy Z TriFold",
    "Pixel 11 Pro Fold", "Xiaomi 17 Ultra", "Redmi Note 15", "POCO F9 Ultra", "iPad mini (A20 Pro, 2026)", "iPad Air 13-inch (M2 to M4)",
    "iPad Air 11-inch (M2 to M4)", "Kindle Paperwhite 6 / 7", "Kindle (2022/2024/2026) / Kindle aluminum", "Kindle Colorsoft / Colorsoft 2",
    "Kindle Scribe 3", "Boox Note Air6 C", "Boox Note Air5 C", "Boox Palma 3", "Boox Picco", "Boox Note Max", "Boox Go 7 / Go Color 7",
    "Boox Go 10.3 (Gen II) Lumi", "Boox Go 6 / Go 6 (Gen II)", "Boox Note Mini C", "MacBook Neo", "MacBook Air 13\" (M2 to M5)", "MacBook Air 15\" (M2 to M5)",
    "MacBook Pro 16\" (M1 to M5)", "Lenovo ThinkPad X1 Carbon Gen 14", "Lenovo ThinkPad P1 Gen 8", "Lenovo ThinkPad T14 Gen 6",
    "Lenovo ThinkPad T16 Gen 5", "Lenovo Legion Tab",
]

# Specific observations made while preparing (structure and consistency only; no external research yet).
NOTES = {
    "iPhone Duo (front)": "Only entry labelled (front); every other outer screen is (cover). Rumored-sounding name: confirm it exists.",
    "iPhone Duo (inner)": "Confirm the product exists and is on sale; check the inner panel's diagonal basis (folded crease, rounded corners).",
    "Galaxy Z Flip8": "Inner screen but not labelled (inner), unlike the Fold rows.",
    "Galaxy Z Flip7": "Inner screen but not labelled (inner), unlike the Fold rows.",
    "Galaxy Z Flip7 FE / Flip6 / Flip5 / Flip4": "Inner screen, not labelled (inner). The matching cover row groups only FE/6/5, because the Flip4 cover differs (separate row).",
    "Galaxy Z Fold8 (inner)": "Smaller (7.6 in) than Fold7's 8.0 in inner screen with a near 4:3 shape: confirm this is a real shipping model and not a mixed-up rumor.",
    "Galaxy Z Fold8 Ultra (inner)": "Confirm model name and existence.",
    "Kindle Scribe 3 / Scribe Colorsoft (2025)": "Groups a monochrome and a color e-ink model. The color model's color layer has a lower resolution than its monochrome resolution.",
    "Boox Go 7 / Go Color 7 (incl. Gen II)": "Groups monochrome and color models (and two generations) in one row.",
    "Kindle Colorsoft / Colorsoft 2": "Color e-ink: 1680 x 1264 is the monochrome resolution; color is lower (about 150 ppi).",
    "Kobo Libra Colour": "Color e-ink. Diagonal written as 7 (no decimal); harmless, the app reads it as 7.0.",
    "Boox Note Air6 C": "Same screen as Air5 C, Air4 C and Air3 C, which are separate rows; other families group identical screens.",
    "Boox Palma 3": "Same screen as the grouped Palma / Palma 2 / Palma 2 Pro row.",
    "Boox Picco": "Unfamiliar product name: confirm it exists.",
    "Galaxy Tab S11 Ultra": "Same screen as S10 Ultra, S9 Ultra and S8 Ultra, all separate rows; S8+ / S7+ and S8 / S7 are grouped. Inconsistent grouping.",
    "MacBook Pro 13\" (M2)": "The M1 (2020) and the 2016 to 2020 Intel 13-inch MacBook Pros have the same 13.3 in 2560 x 1600 screen but aren't named.",
    "MacBook Air 13\" (M1)": "The 2018 to 2020 Intel Retina MacBook Air has the same screen but isn't named.",
    "MacBook Neo 13\"": "Unfamiliar product name: confirm it exists and is on sale.",
    "Surface Duo 2 (one screen)": "A phone filed under Tablet PCs. Each of its two screens is one entry; decide whether the category is right.",
    "Surface Duo (one screen)": "A phone filed under Tablet PCs. Decide whether the category is right.",
    "Lenovo Yoga Book 9i (one screen)": "Dual-screen laptop: one screen per entry. Several generations exist; confirm which panel this is.",
    "Lenovo ThinkPad X1 Fold 16": "Foldable PC: the entry is the unfolded screen.",
    "Lenovo ThinkPad X1 Fold (2020)": "Foldable PC: the entry is the unfolded screen.",
    "Pixel 10 Pro Fold (inner)": "Same inner screen as Pixel 9 Pro Fold and Pixel 11 Pro Fold rows (separate rows).",
    "Surface Pro 11th Edition (13\")": "Sold with OLED or LCD; confirm both are 2880 x 1920 at 13.0 in.",
    "Dell XPS 13 (9350)": "Sold with several panels (FHD+, QHD+, 2.8K OLED). Name doesn't say which one this row is.",
    "Dell XPS 14 (9440)": "Sold with several panels. Name doesn't say which one this row is.",
    "Dell XPS 16 (9640)": "Sold with several panels. Name doesn't say which one this row is.",
    "Lenovo ThinkPad P1 Gen 8": "Sold with several panels. Name doesn't say which one this row is.",
    "Lenovo ThinkPad T14 Gen 6 (Intel/AMD)": "Sold with several panels. Name doesn't say which one this row is.",
    "Lenovo ThinkPad T16 Gen 5 (Intel/AMD)": "Sold with several panels. Name doesn't say which one this row is.",
    "HP Spectre x360 14": "Sold with several panels and generations under one name. Pin the model year.",
    "HP Spectre x360 16": "Sold with several panels and generations under one name. Pin the model year.",
    "ASUS Zenbook 14 OLED": "Many generations and panels share this name. Pin the model number.",
    "Lenovo Yoga 7i 14 (2-in-1)": "Many generations and panels share this name. Pin the generation.",
    "Framework Laptop 16": "Framework sells a 2560 x 1600 panel; check whether other panels exist.",
    "27\" 5K (Apple Studio Display) monitor": "Generic class named after a product: verify Apple Studio Display specs, and that the class name stays generic.",
    "32\" 6K (Pro Display XDR) monitor": "Generic class named after a product: verify Pro Display XDR specs.",
    "Kindle (2019)": "167 ppi entry-level Kindle; check that 2019 is the right model year label.",
    "Credit card": "Must agree with the app's calibration card, ID-1 85.60 x 53.98 mm.",
}

def flags_for(line_no, n, t, d, w, h, same):
    fl = []
    id_ = slug(n)
    if t == "paper":
        fl.append("PAPER_STD")
    else:
        if re.search(r"/| to |incl\.", n): fl.append("GROUP")
        if "(inner)" in n or (n.startswith("Galaxy Z Flip") and "(cover)" not in n): fl.append("FOLD_INNER")
        if "(cover)" in n or "(front)" in n: fl.append("FOLD_COVER")
        if "(one screen)" in n: fl.append("ONE_OF_TWO_SCREENS")
        if "X1 Fold" in n: fl.append("FOLDABLE_PC")
        if t == "ereader" and re.search(r"Colou?r|Colorsoft|\bC\b|\dC\b", n): fl.append("COLOR_EINK")
        if t in ("laptop", "tablet pc") and re.match(r"(Lenovo|Dell|HP|ASUS|Framework)", n): fl.append("CONFIGURABLE")
        if (t == "monitor" and re.match(r"\d", n)) or n.startswith("Typical"): fl.append("GENERIC_CLASS")
        if re.match(r"(iPhone|iPad|MacBook|iMac)", n) or has(n, "Apple Studio Display", "Pro Display XDR"): fl.append("APPLE_DIAGONAL")
        m = re.search(r"(\d+(?:\.\d+)?)(?:\"|-inch| inch)", n)
        if m and abs(float(m.group(1)) - float(d)) > 0.05: fl.append("NAME_SIZE_DIFFERS")
        if any(n.startswith(r) for r in RELEASE_CHECK): fl.append("RELEASE_CHECK")
        if same: fl.append("SAME_SCREEN")
        # names that the app's code reads (dprOf, myScreenMatches): renaming can change website-preview scaling
        if re.match(r"(iPhone|iPad|MacBook|iMac|Surface (RT|Laptop Go|Laptop SE|Studio))", n) or has(n, "Apple Studio", "Pro Display XDR"): fl.append("NAME_DRIVES_CODE")
    if t == "paper": fl.append("NAME_DRIVES_CODE")  # paper menu groups and labels come from the name
    if id_ in defaults: fl.append("FIRST_VISIT_DEFAULT")
    if id_ in alias_of: fl.append("HAS_OLD_IDS")
    if n in tests or id_ in tests: fl.append("USED_IN_TESTS")
    return fl

# identical screens (diagonal and pixels), to show grouping candidates
groups = {}
for _, r in rows:
    if r[1] != "paper": groups.setdefault((float(r[2]), max(int(r[3]), int(r[4])), min(int(r[3]), int(r[4]))), []).append(r[0])

ledger, per_batch = [], {}
for k, (line_no, r) in enumerate(rows, start=1):
    n, t, d, w, h = r
    aid = f"DEV-{k:04d}"
    batch = next(b for b in BATCHES if b[3](n, t))
    if t == "paper":
        wi, hi = max(float(w), float(h)), min(float(w), float(h))
        ppi, win, hin = "", wi, hi
    else:
        W, H = max(int(w), int(h)), min(int(w), int(h))
        hyp = math.hypot(W, H)
        ppi = round(hyp / float(d), 1)
        win, hin = float(d) * W / hyp, float(d) * H / hyp
    same = [] if t == "paper" else [x for x in groups[(float(d), max(int(w), int(h)), min(int(w), int(h)))] if x != n]
    fl = flags_for(line_no, n, t, d, w, h, same)
    note = NOTES.get(n, "")
    if same:
        note = (note + " " if note else "") + "Same diagonal and pixels as: " + "; ".join(same) + "."
    if slug(n) in alias_of:
        note = (note + " " if note else "") + "Old IDs that still open this row: " + ", ".join(alias_of[slug(n)]) + "."
    row_hash = hashlib.sha256(",".join(r).encode()).hexdigest()[:12]
    ledger.append({
        "audit_id": aid, "baseline_line": line_no, "current_id": slug(n), "name": n, "type": t, "diagonal": d, "width": w, "height": h,
        "computed_ppi": ppi, "computed_long_side_in": f"{win:.3f}", "computed_short_side_in": f"{hin:.3f}", "baseline_hash": row_hash,
        "batch_id": batch[0], "primary_model": batch[1], "structure_flags": " ".join(fl), "prep_notes": note,
        "verification_status": "UNVERIFIED", "primary_done": "NO", "primary_action": "", "second_pass": "PENDING", "second_pass_result": "",
        "final_disposition": "", "integrated": "NO", "status_notes": "",
    })
    per_batch.setdefault(batch[0], []).append(ledger[-1])

LEDGER_COLS = list(ledger[0].keys())
with open(os.path.join(AUDIT, "COVERAGE_LEDGER.csv"), "w", newline="", encoding="utf-8") as f:
    wr = csv.DictWriter(f, fieldnames=LEDGER_COLS, lineterminator="\n"); wr.writeheader(); wr.writerows(ledger)

# ---- research templates: the three common results files (see DATABASE_CONTRACT.md section 9) ----
VERIFY_COLS = [
    "original_id", "batch_id", "researcher", "pass", "original_name", "original_type", "original_diagonal", "original_width_px", "original_height_px",
    "manufacturer", "verified_name", "verified_category", "models_covered", "screen_role", "release_year",
    "nominal_diagonal", "verified_diagonal", "verified_width_px", "verified_height_px", "official_ppi", "color_ppi", "color_width_px", "color_height_px",
    "display_technology", "active_width_mm", "active_height_mm", "calculated_ppi", "geometry_basis", "panel_options",
    "verification_status", "product_status", "primary_source_url", "secondary_source_url", "evidence", "verified_date",
    "action", "change_class", "second_pass_reasons", "notes",
]
MISSING_COLS = [
    "new_id", "batch_id", "researcher", "manufacturer", "device_name", "display_variant", "screen_role", "release_year", "category",
    "nominal_diagonal", "verified_diagonal", "width_px", "height_px", "official_ppi", "color_ppi", "color_width_px", "color_height_px",
    "active_width_mm", "active_height_mm", "calculated_ppi", "geometry_basis", "verification_status", "product_status",
    "primary_source_url", "secondary_source_url", "evidence", "verified_date", "inclusion_priority", "existing_equivalent", "reason_for_inclusion", "notes",
]
ISSUE_COLS = [
    "issue_id", "batch_id", "researcher", "related_id", "device_name", "issue_type", "field", "existing_value", "candidate_value",
    "conflicting_sources", "explanation", "suggested_next_step",
]
SCHEMA = {"verification_results": VERIFY_COLS, "missing_devices": MISSING_COLS, "unresolved_issues": ISSUE_COLS}
# reconciled files for integration (DATABASE_CONTRACT.md section 9); not batch files, so check_results.py doesn't read them
RECONCILED = {
    "devices_verified": ["audit_id", "name", "type", "diagonal", "width", "height", "source_url", "reported_ppi", "color_ppi", "status", "geometry_note"],
    "device_changes": ["change_id", "audit_id", "change_type", "field", "old_value", "new_value", "old_app_id", "new_app_id",
                       "needs_renamed_entry", "change_class", "source_url", "evidence", "approved", "notes"],
    "missing_devices_verified": MISSING_COLS,
}
tdir = os.path.join(AUDIT, "templates")
os.makedirs(tdir, exist_ok=True)
for name, cols in SCHEMA.items():
    with open(os.path.join(tdir, f"{name}_header.csv"), "w", newline="", encoding="utf-8") as f:
        csv.writer(f, lineterminator="\n").writerow(cols)
for name, cols in RECONCILED.items():
    with open(os.path.join(tdir, f"{name}_header.csv"), "w", newline="", encoding="utf-8") as f:
        csv.writer(f, lineterminator="\n").writerow(cols)
json.dump(SCHEMA, open(os.path.join(HERE, "schema.json"), "w"), indent=1)
os.makedirs(os.path.join(AUDIT, "batches"), exist_ok=True)
for bid, owner, title, _ in BATCH_ORDER:
    with open(os.path.join(AUDIT, "batches", f"{bid}_verification_results.csv"), "w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=VERIFY_COLS, lineterminator="\n"); wr.writeheader()
        for L in per_batch.get(bid, []):
            wr.writerow({"original_id": L["audit_id"], "batch_id": bid, "researcher": owner, "pass": "primary",
                         "original_name": L["name"], "original_type": L["type"], "original_diagonal": L["diagonal"],
                         "original_width_px": L["width"], "original_height_px": L["height"], "verification_status": "UNVERIFIED"})

# summary for the manifest
summary = [(b[0], b[1], b[2], len(per_batch.get(b[0], []))) for b in BATCH_ORDER]
json.dump({"batches": summary, "total": len(ledger), "baseline_sha256": hashlib.sha256(open(BASE, "rb").read()).hexdigest()},
          open(os.path.join(HERE, "summary.json"), "w"), indent=1)
for s in summary: print(*s, sep="\t")
print("total", len(ledger))
