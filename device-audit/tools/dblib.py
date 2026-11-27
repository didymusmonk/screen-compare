"""Shared helpers for the audit scripts: reading device lists, IDs, geometry, and the app's compatibility maps.

Nothing here edits files. Everything mirrors what index.html does, so the scripts judge rows the way the site will.
"""
import csv, glob, io, json, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.dirname(HERE)
REPO = os.path.dirname(AUDIT)
BASELINE = os.path.join(AUDIT, "devices_original.csv")
CATS = ("phone", "tablet", "ereader", "tablet pc", "laptop", "monitor", "paper")
# tests/unit.js PPI ranges (DATABASE_CONTRACT.md section 7, rule 6)
PPI_RANGE = {"phone": (200, 600), "tablet": (120, 400), "ereader": (150, 350), "tablet pc": (100, 450),
             "laptop": (90, 350), "monitor": (50, 250)}
SMALL = 0.005  # 0.5%: differences below this are rounding, not corrections (Thomas, 27 Nov 2026)


def slug(s):  # same as index.html: "+" counts as "plus"
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s.lower().replace("+", " plus ")))


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def read_devices(path):
    """Reads devices.csv (with # comments) or devices_verified.csv. Returns a list of dicts with
    name, type, diagonal, width, height (strings) plus any extra columns, and 'line' (file line number)."""
    rows, head = [], None
    with open(path, encoding="utf-8-sig", newline="") as fh:
        text = fh.read().splitlines()
    for n, line in enumerate(text, start=1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        cells = [c.strip() for c in next(csv.reader([line]))]
        if head is None:
            head = cells
            continue
        r = dict(zip(head, cells + [""] * (len(head) - len(cells))))
        r["line"] = n
        r["_cells"] = len(cells)
        r["_head"] = len(head)
        rows.append(r)
    return rows


def geom(r):
    """(ppi, long side in, short side in) for a screen row, or None if the numbers are unusable."""
    d, w, h = num(r.get("diagonal")), num(r.get("width")), num(r.get("height"))
    if not (d and w and h) or d <= 0 or w <= 0 or h <= 0:
        return None
    w, h = max(w, h), min(w, h)
    hyp = math.hypot(w, h)
    return hyp / d, d * w / hyp, d * h / hyp


def same_screen(a, b, tol=SMALL):
    """True when two rows have the same pixels and physical size within tol (0.5%)."""
    ga, gb = geom(a), geom(b)
    if not ga or not gb:
        return False
    pa = sorted([num(a["width"]), num(a["height"])])
    pb = sorted([num(b["width"]), num(b["height"])])
    return pa == pb and abs(ga[1] - gb[1]) / ga[1] < tol


def ledger():
    return {r["audit_id"]: r for r in csv.DictReader(open(os.path.join(AUDIT, "COVERAGE_LEDGER.csv"), encoding="utf-8"))}


def app_maps(index_html=None):
    """RENAMED, OLD_PAPER_IDS and the first-visit default IDs, read from index.html."""
    p = index_html or os.path.join(REPO, "index.html")
    src = open(p, encoding="utf-8").read() if os.path.exists(p) else ""

    def obj(name):
        m = re.search(r"const %s\s*=\s*\{(.*?)\};" % name, src, re.S)
        return dict(re.findall(r'"?([\w-]+)"?\s*:\s*"([^"]+)"', m.group(1))) if m else {}

    m = re.search(r"const defaults = \(\) => \(\{\s*sel:\s*\[(.*?)\]", src, re.S)
    defaults = re.findall(r'(?<!\w)id:\s*"([^"]+)"', m.group(1)) if m else []
    m = re.search(r'paper:\s*"([^"]+)"', src[src.find("const defaults"):][:1500]) if "const defaults" in src else None
    if m:
        defaults.append(m.group(1))
    return {"RENAMED": obj("RENAMED"), "OLD_PAPER_IDS": obj("OLD_PAPER_IDS"), "defaults": defaults, "found": bool(src)}


def dpr_rule(name, cat):
    """Which dprOf() branch a name falls into (index.html). A rename that changes this changes the website preview."""
    if re.match(r"^iPhone", name):
        return "iPhone 2x" if re.search(r"\b(SE|XR|11)$|\b(SE|XR)\b", name) else "iPhone 3x"
    for pat, lab in ((r"^iPad", "iPad 2x"), (r"^MacBook", "MacBook ppi/127"), (r"^(iMac|.*Apple Studio|.*Pro Display XDR)", "Apple display 2x"),
                     (r"^Surface (RT|Laptop Go|Laptop SE)", "Surface 1x"), (r"^Surface Studio", "Surface Studio 2x")):
        if re.match(pat, name):
            return lab
    return "category rule (%s)" % cat


def results_files(kind):
    """Every returned results file of one kind (verification_results, missing_devices, unresolved_issues),
    primary passes only, skipping raw copies and second passes (B02/B10 second passes are summarised in their adjudication)."""
    out = []
    for p in sorted(glob.glob(os.path.join(AUDIT, "results", "**", "*_%s.csv" % kind), recursive=True)):
        parts = p.replace("\\", "/").split("/")
        if "as_returned" in parts or "second_pass" in parts or "part1" in parts or "claude_script_check" in parts or "/proposal/" in p:
            continue
        out.append(p)
    return out


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def write_csv(path, head, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, head, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: ("" if r.get(k) is None else str(r.get(k)).replace("\n", " ").replace("\r", " ")) for k in head})


def header(name):
    return open(os.path.join(AUDIT, "templates", name), encoding="utf-8").read().strip().split(",")


APPLE = re.compile(r"^(iPhone|iPad|MacBook|iMac|Apple|Studio Display|Pro Display)|\(Apple ", re.I)


def brand(name, manufacturer=""):
    """Brand of a row, for deciding whether a new device can join an existing row's name."""
    if manufacturer:
        return manufacturer.strip().lower()
    if APPLE.search(name):
        return "apple"
    first = name.split()[0].lower() if name.split() else ""
    return {"galaxy": "samsung", "surface": "microsoft", "pixel": "google", "kindle": "amazon", "fire": "amazon",
            "amazon": "amazon", "redmi": "xiaomi", "poco": "xiaomi", "razr": "motorola", "moto": "motorola"}.get(first, first)
