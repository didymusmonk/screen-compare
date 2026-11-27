#!/usr/bin/env python3
"""Checks a whole device list with fixed rules, no AI and no web. It never edits anything.

Usage (from the repo root):
  python3 device-audit/tools/validate_db.py                       # checks devices_original.csv
  python3 device-audit/tools/validate_db.py device-audit/proposal/devices_verified.csv \
      --renamed device-audit/proposal/renamed_additions.csv --report device-audit/proposal/VALIDATION.md

Options:
  --baseline FILE   list to compare IDs against (default: device-audit/devices_original.csv)
  --renamed FILE    proposed extra RENAMED entries (columns old_id,new_id), added to those in index.html
  --report FILE     also write the findings as Markdown;  --csv FILE   ... and as CSV
  --facts           also use reported/colour PPI and active-area figures from the returned research files

Checks: missing or invalid values; the PPI ranges and 4:1 shape limit in tests/unit.js; maker PPI and active area
against the diagonal (differences under 0.5% are rounding and ignored); duplicate names and IDs; names that only
differ in punctuation or brackets; a model named in two rows; categories that don't fit the name or size;
foldables missing their other screen; colour e-ink rows stored at the colour resolution; and backward
compatibility (every old ID still opens a row, RENAMED is one hop, first-visit defaults and paper IDs exist,
renames that change the website-preview scaling rule).
Severity: ERROR = the site or its tests would break; WARN = look at it; INFO = for information (grouping ideas).
Exit code 1 when there is an ERROR.
"""
import collections, math, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dblib import (BASELINE, CATS, PPI_RANGE, SMALL, app_maps, dpr_rule, geom, num, read_csv, read_devices,
                   results_files, same_screen, slug, write_csv)

ROLE = re.compile(r"\s*\((inner|cover|front|one screen)\)\s*$", re.I)
FOLDY = re.compile(r"\b(Fold\d*|Flip\d*|TriFold|Duo|Open|Find N\d*|Razr|Magic V\d*|X Fold\d*|Mix Fold\d*|Mate X\d*)\b", re.I)
COLOR_EREADER = re.compile(r"(Colou?r|Colorsoft|Kaleido|Gallery|\bC\b|\b[\w.]*\dC\b|C Pro\b)", re.I)
# name pattern -> category it should have (first match wins)
EXPECT = [
    (r"^iPhone", "phone"), (r"^iPad", "tablet"), (r"^MacBook", "laptop"), (r"^iMac|Studio Display|Pro Display", "monitor"),
    (r"^Galaxy Tab\b", "tablet"), (r"^Galaxy (S|Z|A|M|F|Note)\d*\b", "phone"), (r"^Pixel Tablet", "tablet"), (r"^Pixel\b", "phone"),
    (r"^Boox Mira", "monitor"), (r"^(Kindle|Kobo|Boox|reMarkable|PocketBook|Supernote|Tolino|Bigme)\b", "ereader"), (r"^Fire\b", "tablet"),
    (r"^Surface Duo", "phone"), (r"^Surface (Pro|Go|Book|Laptop Studio)", "tablet pc"), (r"^Surface Laptop", "laptop"), (r"^Surface Studio", "monitor"),
    (r"\bmonitor\b", "monitor"), (r"\b(laptop|Chromebook)\b", "laptop"), (r"\bpaper\b", "paper"),
]


class Findings:
    def __init__(self):
        self.items = []

    def add(self, sev, check, row, detail):
        self.items.append({"severity": sev, "check": check, "audit_id": (row or {}).get("audit_id", ""),
                           "name": (row or {}).get("name", ""), "line": (row or {}).get("line", ""), "detail": detail})


def split_top(s):
    """Splits on ' / ' outside brackets."""
    out, depth, cur, i = [], 0, "", 0
    while i < len(s):
        c = s[i]
        depth += c == "("
        depth -= c == ")"
        if depth == 0 and s.startswith(" / ", i):
            out.append(cur)
            cur, i = "", i + 3
            continue
        cur += c
        i += 1
    return [t.strip() for t in out + [cur] if t.strip()]


def models_in(base):
    """'Galaxy Z Flip7 FE / Flip6 / Flip5' -> ['galaxy z flip7 fe', 'galaxy z flip6', 'galaxy z flip5'];
    'Surface Laptop 3 / 4 (15")' -> ['surface laptop 3 (15")', 'surface laptop 4 (15")']."""
    base = re.sub(r"\s*\(incl\.[^)]*\)", "", base).strip()
    toks = split_top(base)
    if not toks:
        return []
    tail = ""
    if len(toks) > 1:
        m = re.search(r'\s*(\([^()]*"[^()]*\))$', toks[-1])
        if m:  # a size bracket after the last model, as in 'Book 3 / Book 2 (15")', applies to all of them
            tail = " " + m.group(1)
            toks[-1] = toks[-1][:m.start()]
    first = toks[0].split()
    out = [toks[0]]
    for t in toks[1:]:
        words = t.split()
        alpha = re.match(r"[A-Za-z]+", words[0])
        if not alpha:  # '4' in 'Surface Laptop 3 / 4'
            out.append(" ".join(first[:-1] + words))
            continue
        idx = next((i for i, w in enumerate(first) if i > 0 and w.lower().startswith(alpha.group(0).lower())), None)
        if idx is not None and not (len(words) > 1 and first[0].lower() == words[0].lower()):
            out.append(" ".join(first[:idx] + words))
        else:
            out.append(t)
    return [(o + tail).lower() for o in out]


def norm_name(n):
    n = n.lower().replace("″", '"').replace("-inch", '"').replace(" inch", '"')
    return re.sub(r"[^a-z0-9\"+]+", " ", n).strip()


def check_rows(rows, F):
    for r in rows:
        n, t = r.get("name", ""), r.get("type", "")
        if r.get("_cells", 0) > r.get("_head", 0):
            F.add("ERROR", "format", r, "more cells than the header (an unquoted comma?)")
        if not n:
            F.add("ERROR", "missing value", r, "empty name")
        if "\n" in n or "\r" in n:
            F.add("ERROR", "format", r, "line break inside the name")
        if t not in CATS:
            F.add("ERROR", "category", r, "type %r isn't one of %s; the row would vanish" % (t, ", ".join(CATS)))
            continue
        d, w, h = num(r.get("diagonal")), num(r.get("width")), num(r.get("height"))
        if t == "paper":
            if r.get("diagonal"):
                F.add("ERROR", "dimensions", r, "paper rows leave diagonal empty")
            if not (w and h) or w <= 0 or h <= 0 or max(w, h) > 30:
                F.add("ERROR", "dimensions", r, "paper width/height must be inches between 0 and 30 (got %r x %r)" % (r.get("width"), r.get("height")))
            continue
        if not d or d <= 0:
            F.add("ERROR", "dimensions", r, "diagonal missing or not a positive number (%r)" % r.get("diagonal"))
            continue
        if not (w and h) or w <= 0 or h <= 0 or w != int(w) or h != int(h):
            F.add("ERROR", "dimensions", r, "width/height must be whole pixel counts (got %r x %r)" % (r.get("width"), r.get("height")))
            continue
        if "." in r["diagonal"] and len(r["diagonal"].split(".")[1]) > 2:
            F.add("WARN", "dimensions", r, "diagonal has more than two decimals (%s); visitors see it as written" % r["diagonal"])
        ppi, L, S = geom(r)
        lo, hi = PPI_RANGE[t]
        if not lo <= ppi <= hi:
            F.add("ERROR", "PPI range", r, "%.1f ppi is outside the unit test's %s range %d-%d" % (ppi, t, lo, hi))
        if max(w, h) / min(w, h) > 4:
            F.add("ERROR", "shape", r, "shape %.2f:1 is beyond the unit test's 4:1 limit" % (max(w, h) / min(w, h)))
        m = re.search(r'(\d+(?:\.\d+)?)\s*(?:"|″|-inch|\s?inch\b)', n)
        if m:
            ns = float(m.group(1))
            if abs(ns - d) / d > 0.06:
                F.add("WARN", "name vs diagonal", r, 'name says %g" but diagonal is %g (%.0f%% apart)' % (ns, d, abs(ns - d) / d * 100))


def check_dupes(rows, F):
    by_name, by_id, by_norm, by_base = (collections.defaultdict(list) for _ in range(4))
    for r in rows:
        by_name[r["name"]].append(r)
        by_id[slug(r["name"])].append(r)
        by_norm[norm_name(r["name"])].append(r)
        if r["type"] != "paper":
            by_base[(r["type"], norm_name(re.sub(r"\([^)]*\)", "", r["name"])))].append(r)
    for k, v in by_name.items():
        if len(v) > 1:
            F.add("ERROR", "duplicate", v[1], "name appears %d times (lines %s)" % (len(v), ", ".join(str(x["line"]) for x in v)))
    for k, v in by_id.items():
        if len(v) > 1 and len({x["name"] for x in v}) > 1:
            F.add("ERROR", "duplicate ID", v[1], "ID %s is made by %s; only one could be picked" % (k, " and ".join(repr(x["name"]) for x in v)))
    for k, v in by_norm.items():
        if len({x["name"] for x in v}) > 1 and len({slug(x["name"]) for x in v}) > 1:
            F.add("WARN", "ambiguous name", v[1], "differs from %r only in punctuation" % v[0]["name"])
    for (t, base), v in by_base.items():
        roles = {(ROLE.search(x["name"]) or [None, ""])[1].lower() for x in v}
        if len(v) > 1 and len(roles) == 1 and not all(same_screen(v[0], x) for x in v[1:]):
            F.add("INFO", "ambiguous name", v[1], "different screens whose names differ only inside brackets: %s"
                  % "; ".join(x["name"] for x in v))
    # identical screens in one category and family: grouping ideas, not errors
    fam = collections.defaultdict(list)
    for r in rows:
        if r["type"] == "paper" or not geom(r):
            continue
        key = (r["type"], r["name"].split()[0].lower(), tuple(sorted([int(num(r["width"])), int(num(r["height"]))])), round(geom(r)[1], 2))
        fam[key].append(r)
    for v in fam.values():
        if len(v) > 1:
            F.add("INFO", "same screen", v[0], "same screen as %s (separate rows are fine when people search for each)" % "; ".join(x["name"] for x in v[1:]))


def check_groups(rows, F):
    seen = collections.defaultdict(list)
    for r in rows:
        if r["type"] == "paper":
            continue
        m = ROLE.search(r["name"])
        role = m.group(1).lower() if m else ""
        base = ROLE.sub("", r["name"])
        for mdl in models_in(base):
            seen[(mdl, role)].append(r)
    for (mdl, role), v in seen.items():
        if len(v) > 1:
            same = all(same_screen(v[0], x) for x in v[1:])
            F.add("WARN" if not same else "INFO", "grouping", v[1], "model %r%s is named in %d rows (%s)%s" % (
                mdl, " (%s)" % role if role else "", len(v), "; ".join(x["name"] for x in v),
                "" if same else " with different screens: one of them is probably wrong or the group is too wide"))


def check_categories(rows, F):
    for r in rows:
        n, t = r["name"], r["type"]
        for pat, want in EXPECT:
            if re.search(pat, n, re.I):
                if want != t:
                    F.add("WARN", "category", r, "name suggests %s but type is %s" % (want, t))
                break
        g = geom(r)
        if not g or t == "paper":
            continue
        d = num(r["diagonal"])
        role = (ROLE.search(n) or [None, ""])[1].lower()
        if t == "phone" and d > 7.3 and role not in ("inner",) and not FOLDY.search(n):
            F.add("WARN", "category", r, '%g" is large for a phone that isn\'t a foldable inner screen' % d)
        if t == "tablet" and d < 7:
            F.add("WARN", "category", r, '%g" is small for a tablet' % d)
        if t == "monitor" and d < 13:
            F.add("WARN", "category", r, '%g" is small for a monitor' % d)
        if t == "laptop" and (d < 10 or d > 18.5):
            F.add("WARN", "category", r, '%g" is unusual for a laptop' % d)
        if t == "ereader" and not 3 <= d <= 14:
            F.add("WARN", "category", r, '%g" is unusual for an e-reader' % d)


def check_foldables(rows, F):
    names = {r["name"] for r in rows}
    bases = collections.defaultdict(set)
    for r in rows:
        if r["type"] != "phone":
            continue
        m = ROLE.search(r["name"])
        role = m.group(1).lower() if m else ""
        for mdl in models_in(ROLE.sub("", r["name"])):
            bases[mdl].add(role)
    for r in rows:
        if r["type"] != "phone":
            continue
        m = ROLE.search(r["name"])
        role = m.group(1).lower() if m else ""
        for mdl in models_in(ROLE.sub("", r["name"])):
            have = bases[mdl]
            if role == "inner" and not have & {"cover", "front"}:
                F.add("WARN", "foldable", r, "%r has an inner screen row but no (cover) row" % mdl)
            if role in ("cover", "front") and not have & {"inner", ""}:
                F.add("WARN", "foldable", r, "%r has a %s row but no main (inner) screen row" % (mdl, role))
            if role == "" and re.search(r"\bflip\d*\b|\brazr\b", mdl, re.I) and "cover" not in have:
                F.add("WARN", "foldable", r, "flip phone %r has no (cover) row" % mdl)
            if role == "" and re.search(r"\b(fold\d*|trifold|open|find n\d*|duo|magic v\d*|x fold\d*|mate x\d*)\b", mdl, re.I) and "inner" not in have:
                F.add("WARN", "foldable", r, "%r looks like a book-style foldable but has no (inner)/(cover) label" % mdl)


def check_color(rows, F, facts):
    for r in rows:
        if r["type"] != "ereader" or not geom(r):
            continue
        ppi = geom(r)[0]
        colour = COLOR_EREADER.search(r["name"])
        if colour and ppi < 250:
            F.add("WARN", "colour e-ink", r, "colour e-reader stored at %.0f ppi; is that the colour resolution? The list keeps the monochrome (full) resolution, usually 300 ppi" % ppi)
        c = facts.get(r.get("audit_id")) or facts.get(slug(r["name"])) or {}
        cp = num(r.get("color_ppi")) or c.get("color_ppi")
        if cp:
            ratio = cp / ppi
            if ratio >= 0.95 and re.search(r"reMarkable Paper Pro|Gallery", r["name"] + " " + (r.get("geometry_note") or ""), re.I):
                F.add("INFO", "colour e-ink", r, "colour at full resolution (%.0f ppi), as Gallery 3 panels do" % cp)
            elif ratio >= 0.95:
                F.add("WARN", "colour e-ink", r, "colour PPI %.0f is not below the monochrome %.0f; the two may be swapped or the row stores the colour resolution" % (cp, ppi))
            elif not 0.4 <= ratio <= 0.6:
                F.add("WARN", "colour e-ink", r, "colour PPI %.0f is %.2f x the monochrome %.0f (usually about half)" % (cp, ratio, ppi))
        elif colour and not facts.get("_none"):
            F.add("INFO", "colour e-ink", r, "colour model without a recorded colour resolution")


def check_facts(rows, F, facts):
    for r in rows:
        g = geom(r)
        if not g:
            continue
        c = facts.get(r.get("audit_id")) or facts.get(slug(r["name"])) or {}
        op = num(r.get("reported_ppi")) or c.get("official_ppi")
        if op and abs(g[0] - op) / op > 0.02:
            F.add("WARN", "PPI vs maker", r, "maker says %g ppi, the diagonal and pixels give %.1f (%.1f%% apart)" % (op, g[0], abs(g[0] - op) / op * 100))
        aw, ah = c.get("active_width_mm"), c.get("active_height_mm")
        if aw and ah:
            L, S = max(aw, ah) / 25.4, min(aw, ah) / 25.4
            dev = max(abs(L - g[1]) / L, abs(S - g[2]) / S)
            if dev >= SMALL:
                F.add("WARN", "size vs active area", r, "maker's active area is %.2f x %.2f in, the row draws %.2f x %.2f in (%.1f%% apart)"
                      % (L, S, g[1], g[2], dev * 100))


def check_compat(rows, base_rows, maps, extra_renamed, F):
    cur = {slug(r["name"]): r for r in rows}
    renamed = dict(maps["RENAMED"])
    renamed.update(extra_renamed)
    for old, new in renamed.items():
        if new not in cur:
            F.add("ERROR", "compatibility", {"name": old}, "RENAMED %s -> %s points at an ID that no longer exists" % (old, new))
        if old in cur:
            F.add("ERROR", "compatibility", cur[old], "RENAMED key %s is also a current ID" % old)
        if new in renamed:
            F.add("ERROR", "compatibility", {"name": old}, "RENAMED %s -> %s -> %s needs two hops; the app follows only one" % (old, new, renamed[new]))
    for b in base_rows:
        bid = slug(b["name"])
        if bid in cur:
            r = cur[bid]
            if b["type"] != "paper" and not same_screen(b, r):
                F.add("INFO", "compatibility", r, "keeps ID %s but the screen changes (%s, %s x %s -> %s, %s x %s); fine for a correction, wrong if it is now a different device"
                      % (bid, b["diagonal"], b["width"], b["height"], r["diagonal"], r["width"], r["height"]))
            continue
        tgt = renamed.get(bid)
        if not tgt:
            F.add("ERROR", "compatibility", b, "old ID %s no longer opens any row: saved comparisons and share links would drop it; add a RENAMED entry" % bid)
        elif tgt in cur and dpr_rule(b["name"], b["type"]) != dpr_rule(cur[tgt]["name"], cur[tgt]["type"]):
            F.add("WARN", "compatibility", cur[tgt], "rename changes the website-preview scaling rule (%s -> %s)" % (dpr_rule(b["name"], b["type"]), dpr_rule(cur[tgt]["name"], cur[tgt]["type"])))
    for i in maps["defaults"]:
        if i not in cur:
            F.add("ERROR", "compatibility", {"name": i}, "first-visit default %s is missing" % i)
    for k, v in maps["OLD_PAPER_IDS"].items():
        if v not in cur:
            F.add("ERROR", "compatibility", {"name": v}, "old paper ID %s points at %s, which is missing" % (k, v))
    if not maps["found"]:
        F.add("WARN", "compatibility", None, "index.html not found, so RENAMED and defaults were not checked")


def load_facts():
    """Maker PPI, colour PPI and active area from the returned research files, keyed by audit ID (and app ID for new devices)."""
    facts = {}
    for p in results_files("verification_results"):
        for r in read_csv(p):
            d = {k: num(r.get(k)) for k in ("official_ppi", "color_ppi", "active_width_mm", "active_height_mm")}
            if num(r.get("verified_diagonal")) and num(r.get("original_diagonal")) and abs(num(r["verified_diagonal"]) - num(r["original_diagonal"])) > 0.001:
                d = {"color_ppi": d["color_ppi"]}  # figures for a different diagonal don't apply to the stored row
            facts[r["original_id"]] = {k: v for k, v in d.items() if v}
    for p in results_files("missing_devices"):
        for r in read_csv(p):
            d = {k: num(r.get(k)) for k in ("official_ppi", "color_ppi", "active_width_mm", "active_height_mm")}
            facts[r["new_id"]] = {k: v for k, v in d.items() if v}
    return facts


def run(path, baseline=BASELINE, renamed_file=None, use_facts=False, index_html=None):
    rows = read_devices(path)
    for r in rows:
        r.setdefault("audit_id", "")
    F = Findings()
    check_rows(rows, F)
    good = [r for r in rows if r.get("type") in CATS and r.get("name")]
    check_dupes(good, F)
    check_groups(good, F)
    check_categories(good, F)
    check_foldables(good, F)
    facts = load_facts() if use_facts else {"_none": True}
    check_color(good, F, facts)
    if use_facts:
        check_facts(good, F, facts)
    extra = {}
    if renamed_file and os.path.exists(renamed_file):
        extra = {r["old_id"]: r["new_id"] for r in read_csv(renamed_file) if r.get("old_id")}
    if baseline and os.path.abspath(baseline) != os.path.abspath(path):
        check_compat(good, read_devices(baseline), app_maps(index_html), extra, F)
    else:
        check_compat(good, [], app_maps(index_html), extra, F)
    return rows, F


def markdown(path, rows, F):
    sev = collections.Counter(i["severity"] for i in F.items)
    screens = sum(1 for r in rows if r.get("type") != "paper")
    out = ["# Validation report", "",
           "File: `%s`: %d rows (%d screens, %d paper sizes)." % (os.path.relpath(path), len(rows), screens, len(rows) - screens),
           "Result: **%d errors, %d warnings, %d notes.** Errors would break the site or its tests; warnings need a look; notes are grouping ideas and other information." % (sev["ERROR"], sev["WARN"], sev["INFO"]), ""]
    for s in ("ERROR", "WARN", "INFO"):
        items = [i for i in F.items if i["severity"] == s]
        if not items:
            continue
        out.append("## %s" % {"ERROR": "Errors", "WARN": "Warnings", "INFO": "Notes"}[s])
        by = collections.defaultdict(list)
        for i in items:
            by[i["check"]].append(i)
        for c, v in by.items():
            out.append("\n**%s** (%d)\n" % (c, len(v)))
            for i in v:
                who = " ".join(x for x in (i["audit_id"], ("`%s`" % i["name"]) if i["name"] else "") if x)
                out.append("- %s%s" % (who + ": " if who else "", i["detail"]))
        out.append("")
    return "\n".join(out) + "\n"


def main(argv):
    args = argv[1:]
    if any(a in ("-h", "--help") for a in args):
        print(__doc__)
        return 0
    opts, pos = {}, []
    it = iter(args)
    for a in it:
        if a in ("--baseline", "--renamed", "--report", "--csv", "--index"):
            opts[a] = next(it)
        elif a == "--facts":
            opts[a] = True
        else:
            pos.append(a)
    path = pos[0] if pos else BASELINE
    rows, F = run(path, opts.get("--baseline", BASELINE), opts.get("--renamed"), bool(opts.get("--facts")), opts.get("--index"))
    md = markdown(path, rows, F)
    if "--report" in opts:
        open(opts["--report"], "w", encoding="utf-8").write(md)
    if "--csv" in opts:
        write_csv(opts["--csv"], ["severity", "check", "audit_id", "name", "line", "detail"], F.items)
    print(md if "--report" not in opts else md.split("\n## ")[0])
    return 1 if any(i["severity"] == "ERROR" for i in F.items) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
