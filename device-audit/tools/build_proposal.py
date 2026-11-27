#!/usr/bin/env python3
"""Turns all returned research into the three deliverables, applying the practical accuracy rules. Re-run it any time;
it only writes into device-audit/proposal/.

Usage (from the repo root):  python3 device-audit/tools/build_proposal.py

Reads: devices_original.csv, COVERAGE_LEDGER.csv, every primary results file under results/ (verification_results,
missing_devices, unresolved_issues), and decisions.csv (Claude's rulings that override the automatic rules).

Writes to device-audit/proposal/:
  devices_verified.csv          the proposed device list (devices.csv columns + audit_id, source_url, reported_ppi,
                                color_ppi, status, geometry_note); names are unchanged unless a rename is approved
  device_changes.csv            one row per change, with an empty 'approved' column for Thomas
  missing_devices_verified.csv  every proposed new device, with the decision taken
  renamed_additions.csv         RENAMED entries the proposal needs (old_id,new_id)
  EXCEPTIONS.md                 significant corrections, unresolved and uncertain rows, renames, coverage
  MISSING_DEVICES_SUMMARY.md    proposed additions, group-name extensions, optional and queued devices
  VALIDATION.md, validation_findings.csv   validate_db.py run on devices_verified.csv

Automatic rules (Thomas, 27 Nov 2026):
  * One reliable manufacturer source is enough. CONFIRMED or CORROBORATED figures are applied.
  * Same pixels and a physical size within 0.5%: rounding, the original row is kept and the difference is ignored.
  * Bigger changes with a CONFIRMED/CORROBORATED source are applied and listed as significant corrections.
  * Anything less certain keeps the current figures, marked partial, estimated or unverified, and is listed.
  * Renames, category changes, splits and merges are never applied automatically (they change saved IDs); they are
    listed for approval. Unreleased devices are never added.
  * A new device whose screen matches an existing row becomes a proposal to add its name to that row.
"""
import collections, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dblib import (AUDIT, BASELINE, SMALL, brand, geom, header, ledger, num, read_csv, read_devices, results_files, same_screen,
                   slug, write_csv)
import validate_db

OUT = os.path.join(AUDIT, "proposal")
SURE = {"CONFIRMED", "CORROBORATED"}
STATUS_WORD = {"CONFIRMED": "", "CORROBORATED": "", "PARTIAL": "partial", "ESTIMATED": "estimated", "RUMORED": "unverified", "UNVERIFIED": "unverified"}
DV_HEAD = ["audit_id", "name", "type", "diagonal", "width", "height", "source_url", "reported_ppi", "color_ppi", "status", "geometry_note"]


def fmt(x):
    if x in (None, ""):
        return ""
    v = num(x)
    if v is None:
        return str(x)
    return str(int(v)) if v == int(v) else ("%g" % v)


def pct(a, b):
    """Largest relative difference in long or short side between two rows (as a fraction)."""
    ga, gb = geom(a), geom(b)
    if not ga or not gb:
        return None
    return max(abs(ga[1] - gb[1]) / ga[1], abs(ga[2] - gb[2]) / ga[2])


def load_results():
    ver, miss, iss = {}, [], []
    for p in results_files("verification_results"):
        for r in read_csv(p):
            if r.get("pass", "primary") in ("primary", "adjudication"):
                if r["original_id"] in ver and ver[r["original_id"]].get("pass") == "adjudication":
                    continue
                r["_file"] = os.path.relpath(p, AUDIT)
                ver[r["original_id"]] = r
    for p in results_files("missing_devices"):
        for r in read_csv(p):
            r["_file"] = os.path.relpath(p, AUDIT)
            miss.append(r)
    for p in results_files("unresolved_issues"):
        for r in read_csv(p):
            r["_file"] = os.path.relpath(p, AUDIT)
            iss.append(r)
    return ver, miss, iss


def main():
    L = ledger()
    base = {r["audit_id"]: r for r in L.values()}
    ver, miss, issues = load_results()
    dec = {r["id"]: r for r in read_csv(os.path.join(AUDIT, "decisions.csv"))} if os.path.exists(os.path.join(AUDIT, "decisions.csv")) else {}

    rows, changes, ex = [], [], collections.defaultdict(list)
    renamed = []

    def change(aid, ctype, field="", old="", new="", oid="", nid="", cls="none", src="", ev="", note=""):
        changes.append({"change_id": "CHG-%04d" % (len(changes) + 1), "audit_id": aid, "change_type": ctype, "field": field,
                        "old_value": old, "new_value": new, "old_app_id": oid, "new_app_id": nid or oid,
                        "needs_renamed_entry": "YES" if ctype in ("RENAME", "SPLIT", "MERGE") or (oid and nid and oid != nid) else "NO",
                        "change_class": cls, "source_url": src, "evidence": ev, "approved": "", "notes": note})

    for aid, b in base.items():
        orig = {"name": b["name"], "type": b["type"], "diagonal": b["diagonal"], "width": b["width"], "height": b["height"]}
        oid = b["current_id"]
        r = ver.get(aid)
        d = dec.get(aid, {})
        row = dict(orig, audit_id=aid, source_url="", reported_ppi="", color_ppi="", status="unverified", geometry_note="")
        if r is None:
            row["status"] = "unverified"
            change(aid, "KEEP", oid=oid, note="Not researched yet (%s)." % b["batch_id"])
            ex["open"].append((aid, b))
            rows.append(row)
            continue
        vs, act = r.get("verification_status", "UNVERIFIED"), r.get("action", "")
        src = r.get("primary_source_url") or r.get("secondary_source_url")
        row["source_url"] = src if src and src.startswith("https://") else ""
        if num(r.get("official_ppi")):
            row["reported_ppi"] = fmt(r["official_ppi"])
        if num(r.get("color_ppi")):
            row["color_ppi"] = fmt(r["color_ppi"])
        row["status"] = STATUS_WORD.get(vs, "unverified")
        if r.get("screen_role") in ("inner", "cover", "unfolded", "one_of_two"):
            row["geometry_note"] = {"inner": "inner screen, unfolded", "cover": "cover screen", "unfolded": "unfolded screen", "one_of_two": "one of two screens"}[r["screen_role"]]
        if r.get("geometry_basis") in ("NOMINAL_ONLY", "PPI_IMPLIED") and row["status"] == "":
            row["status"] = "estimated"
        prod = r.get("product_status", "")
        note = (r.get("notes") or "").strip()

        # candidate figures from the research
        cand = dict(orig)
        if r.get("verified_diagonal"):
            cand["diagonal"] = fmt(r["verified_diagonal"])
        if r.get("verified_width_px") and r.get("verified_height_px") and b["type"] != "paper":
            w, h = num(r["verified_width_px"]), num(r["verified_height_px"])
            if w and h:
                cand["width"], cand["height"] = fmt(max(w, h)), fmt(min(w, h))
        if b["type"] == "paper" and r.get("verified_width_px") and r.get("verified_height_px"):
            cand["width"], cand["height"] = fmt(r["verified_width_px"]), fmt(r["verified_height_px"])

        decision = d.get("decision", "")
        if d.get("status") or decision == "HOLD":
            row["status"] = d.get("status") or "unverified"
        if decision in ("KEEP", "HOLD"):
            change(aid, "KEEP" if decision == "KEEP" else "FLAG", oid=oid, src=src, note=d.get("note", ""))
            if row["status"]:
                ex["uncertain"].append((aid, b, row["status"], d.get("note", "")))
            rows.append(row)
            continue
        if decision == "CORRECT":
            for k in ("diagonal", "width", "height", "type"):
                if d.get(k):
                    cand[k] = d[k]
            vs = "CONFIRMED"

        figs_differ = b["type"] != "paper" and not (sorted([num(cand["width"]), num(cand["height"])]) == sorted([num(orig["width"]), num(orig["height"])])
                                                    and num(cand["diagonal"]) == num(orig["diagonal"]))
        pc, po = sorted([num(cand["width"]) or 0, num(cand["height"]) or 0]), sorted([num(orig["width"]), num(orig["height"])])
        paper_differ = b["type"] == "paper" and (abs(pc[0] - po[0]) > 0.01 or abs(pc[1] - po[1]) > 0.01)  # orientation doesn't matter
        if figs_differ:
            same_px = sorted([num(cand["width"]), num(cand["height"])]) == sorted([num(orig["width"]), num(orig["height"])])
            dev = pct(orig, cand)
            if same_px and dev is not None and dev < SMALL:
                ex["ignored"].append((aid, b, orig["diagonal"], cand["diagonal"], dev))
                change(aid, "KEEP", oid=oid, src=src, note="Research gives %s in; under 0.5%% from %s, so kept as rounding." % (cand["diagonal"], orig["diagonal"]))
            elif (vs in SURE or decision == "CORRECT") and prod not in ("RUMORED", "ANNOUNCED", "CANCELLED"):
                for k in ("diagonal", "width", "height"):
                    if fmt(cand[k]) != fmt(orig[k]):
                        change(aid, "CORRECT", k, orig[k], cand[k], oid, oid, "material" if dev is None or dev >= SMALL or not same_px else "minor", src, r.get("evidence", ""), note or d.get("note", ""))
                row.update({k: cand[k] for k in ("diagonal", "width", "height")})
                ex["corrected"].append((aid, b, orig, cand, dev, src, r.get("evidence", "")))
            else:
                change(aid, "FLAG", oid=oid, src=src, note="Research suggests %s in, %s x %s (%s); not applied: %s." % (cand["diagonal"], cand["width"], cand["height"], vs, note or "source not certain"))
                row["status"] = row["status"] or "unverified"
                ex["disputed"].append((aid, b, orig, cand, vs, src, note))
        elif paper_differ:
            change(aid, "FLAG", oid=oid, src=src, note="Research suggests %s x %s in; check against the standard." % (cand["width"], cand["height"]))
            ex["disputed"].append((aid, b, orig, cand, vs, src, note))
        else:
            change(aid, "KEEP", oid=oid, src=src)

        if prod in ("RUMORED", "ANNOUNCED", "CANCELLED") or act == "FLAG_FOR_REVIEW":
            row["status"] = "unverified"
            ex["release"].append((aid, b, prod or "?", vs, note))
        elif row["status"] in ("partial", "estimated", "unverified") and aid not in [x[0] for x in ex["disputed"]]:
            ex["uncertain"].append((aid, b, row["status"], note))

        newname = d.get("name") if decision == "RENAME_PROPOSED" else (r.get("verified_name") or "").strip()
        if newname and newname != b["name"]:
            change(aid, "RENAME", "name", b["name"], newname, oid, slug(newname), "material", src, "", "Proposed, not applied in devices_verified.csv. " + (d.get("note") or note))
            ex["rename"].append((aid, b, newname, d.get("note") or note))
        vc = (r.get("verified_category") or "").strip()
        if vc and vc != b["type"]:
            change(aid, "CORRECT", "type", b["type"], vc, oid, oid, "material", src, "", "Proposed, not applied. " + note)
            ex["category"].append((aid, b, vc, note))
        if act in ("SPLIT", "MERGE") and decision != "KEEP":
            change(aid, act, oid=oid, src=src, note="Proposed, not applied. " + note)
            ex["structure"].append((aid, b, act, note))
        rows.append(row)

    # new devices
    by_id = {r["audit_id"]: r for r in rows}
    md = []
    adds = []
    for m in miss:
        nid = m["new_id"]
        d = dec.get(nid, {})
        cand = {"name": d.get("name") or m["device_name"], "type": d.get("type") or m["category"], "diagonal": fmt(d.get("diagonal") or m["verified_diagonal"]),
                "width": fmt(d.get("width") or m["width_px"]), "height": fmt(d.get("height") or m["height_px"])}
        if num(cand["width"]) and num(cand["height"]) and cand["type"] != "paper":
            w, h = num(cand["width"]), num(cand["height"])
            cand["width"], cand["height"] = fmt(max(w, h)), fmt(min(w, h))
        eq = re.findall(r"DEV-\d{4}", m.get("existing_equivalent", ""))
        # join an existing row's name only for the same screen AND the same brand (a Kobo never joins a Kindle row)
        target = d.get("target") or next((e for e in eq if e in by_id and same_screen(by_id[e], cand)
                                          and brand(by_id[e]["name"]) == brand(cand["name"], m.get("manufacturer", ""))), "")
        decision = d.get("decision")
        if not decision and target and set(validate_db.models_in(validate_db.ROLE.sub("", cand["name"]))) <= set(validate_db.models_in(validate_db.ROLE.sub("", by_id[target]["name"]))):
            decision = "SKIP"  # already named in that row
            m = dict(m, notes=("Already named in %s. " % target) + (m.get("notes") or ""))
        prod, vs, pri = m.get("product_status", ""), m.get("verification_status", ""), m.get("inclusion_priority", "")
        if not decision:
            if prod in ("RUMORED", "ANNOUNCED", "CANCELLED", "UNKNOWN") or pri == "review_queue":
                decision = "QUEUE"
            elif target:
                decision = "GROUP"
            elif pri == "optional":
                decision = "OPTIONAL"
            elif vs in SURE | {"PARTIAL", "ESTIMATED"}:
                decision = "ADD"
            else:
                decision = "OPTIONAL"
        m2 = dict(m, decision=decision, proposed_name=cand["name"] if decision == "ADD" else (by_id[target]["name"] if target else ""))
        if decision == "GROUP" and target:
            m2["existing_equivalent"] = target
        md.append(m2)
        if decision == "ADD":
            src = m.get("primary_source_url") or m.get("secondary_source_url") or ""
            role = m.get("screen_role", "")
            row = dict(cand, audit_id=nid, source_url=src if src.startswith("https://") else "", reported_ppi=fmt(m.get("official_ppi")),
                       color_ppi=fmt(m.get("color_ppi")), status=STATUS_WORD.get(vs, "unverified"),
                       geometry_note={"inner": "inner screen, unfolded", "cover": "cover screen"}.get(role, ""))
            adds.append(row)
            change(nid, "ADD", "", "", cand["name"], "", slug(cand["name"]), "material", src, m.get("evidence", ""), d.get("note") or m.get("reason_for_inclusion", ""))

    # place each new row after the last row of its category with the same first word (else end of category)
    first = lambda r: r["name"].split()[0].lower()
    for a in adds:
        same = [i for i, r in enumerate(rows) if r["type"] == a["type"] and first(r) == first(a)]
        cat = [i for i, r in enumerate(rows) if r["type"] == a["type"]]
        idx = same[-1] if same else (cat[-1] if cat else len(rows) - 1)
        rows.insert(idx + 1, a)

    os.makedirs(OUT, exist_ok=True)
    write_csv(os.path.join(OUT, "devices_verified.csv"), DV_HEAD, rows)
    write_csv(os.path.join(OUT, "device_changes.csv"), header("device_changes_header.csv"), changes)
    write_csv(os.path.join(OUT, "missing_devices_verified.csv"), header("missing_devices_verified_header.csv") + ["decision", "proposed_name"], md)
    write_csv(os.path.join(OUT, "renamed_additions.csv"), ["old_id", "new_id", "audit_id"], renamed)

    vrows, F = validate_db.run(os.path.join(OUT, "devices_verified.csv"), BASELINE, os.path.join(OUT, "renamed_additions.csv"), True)
    open(os.path.join(OUT, "VALIDATION.md"), "w", encoding="utf-8").write(validate_db.markdown(os.path.join(OUT, "devices_verified.csv"), vrows, F))
    write_csv(os.path.join(OUT, "validation_findings.csv"), ["severity", "check", "audit_id", "name", "line", "detail"], F.items)

    update_ledger(L, ver, changes)
    write_exceptions(ex, issues, ver, base, F, len(rows), len(adds), md)
    write_missing(md, by_id)
    sev = collections.Counter(i["severity"] for i in F.items)
    print("devices_verified.csv: %d rows (%d original, %d proposed additions)" % (len(rows), len(base), len(adds)))
    print("researched: %d of %d original rows; corrections applied: %d; ignored as rounding: %d; disputed: %d; release checks open: %d"
          % (len(ver), len(base), len(ex["corrected"]), len(ex["ignored"]), len(ex["disputed"]), len(ex["release"])))
    print("validation: %d errors, %d warnings, %d notes (proposal/VALIDATION.md)" % (sev["ERROR"], sev["WARN"], sev["INFO"]))
    return 1 if sev["ERROR"] else 0


def update_ledger(L, ver, changes):
    """Records each researched row's outcome in COVERAGE_LEDGER.csv. B02 and B10 (adjudicated by hand) are left as they are."""
    import csv, io
    path = os.path.join(AUDIT, "COVERAGE_LEDGER.csv")
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    kinds = collections.defaultdict(set)
    for c in changes:
        kinds[c["audit_id"]].add(c["change_type"])
    for r in rows:
        v = ver.get(r["audit_id"])
        if not v or r["batch_id"] in ("B02", "B10"):
            continue
        k = kinds[r["audit_id"]]
        r.update(verification_status=v.get("verification_status", ""), primary_done="YES", primary_action=v.get("action", ""),
                 primary_model=v.get("researcher", "gemini").lower(), second_pass="NOT_NEEDED",
                 final_disposition="CORRECT" if "CORRECT" in k else "HOLD" if "FLAG" in k else "KEEP",
                 status_notes="Simplified workflow (27 Nov 2026): one Gemini pass, checked by script%s." % (
                     "; proposals listed in proposal/EXCEPTIONS.md" if k - {"KEEP"} else ""))
    b = io.StringIO()
    w = csv.DictWriter(b, list(rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    open(path, "w", encoding="utf-8").write(b.getvalue())


def nm(b):
    return "%s `%s`" % (b["audit_id"], b["name"])


def write_exceptions(ex, issues, ver, base, F, total, nadd, md):
    o = ["# Exceptions report", "",
         "Generated by `tools/build_proposal.py` from every returned research file and `decisions.csv`. Everything not listed here was kept as it is, "
         "with a source recorded in `devices_verified.csv` where research found one.", "",
         "Proposed list: **%d rows** (%d original, %d proposed additions). Research so far covers **%d of %d** original rows." % (total, len(base), nadd, len(ver), len(base)), ""]
    dec = read_csv(os.path.join(AUDIT, "decisions.csv")) if os.path.exists(os.path.join(AUDIT, "decisions.csv")) else []
    if dec:
        o.append("## Claude's rulings (`decisions.csv`)\n")
        o.append("These override the researchers' answers. Where Gemini said a product was rumored or a figure was wrong, Claude checked the maker's own page.\n")
        for d in dec:
            b = base.get(d["id"])
            o.append("- %s%s: **%s**%s. %s" % (d["id"], " `%s`" % b["name"] if b else "", d["decision"], (" `%s`" % d["name"]) if d.get("name") else "", d.get("note", "")))
        o.append("")
    o.append("## 1. Significant corrections (applied in the proposal)\n")
    if ex["corrected"]:
        o.append("| Row | Was | Proposed | Size change | Source |\n|---|---|---|---:|---|")
        for aid, b, orig, cand, dev, src, ev in ex["corrected"]:
            o.append("| %s | %s\", %s x %s | %s\", %s x %s | %s | %s |" % (nm(b), orig["diagonal"], orig["width"], orig["height"], cand["diagonal"], cand["width"], cand["height"],
                                                                   "%.1f%%" % (dev * 100) if dev is not None else "-", src or "-"))
    else:
        o.append("None so far.")
    o.append("\n## 2. Disputed or unconfirmed figures (not applied, need a look)\n")
    if ex["disputed"]:
        for aid, b, orig, cand, vs, src, note in ex["disputed"]:
            o.append("- %s: research says %s\", %s x %s (%s). %s %s" % (nm(b), cand["diagonal"], cand["width"], cand["height"], vs, note, src or ""))
    else:
        o.append("None so far.")
    o.append("\n## 3. Release status open (unreleased or unproven products)\n")
    o.append("\n".join("- %s: product status %s, research %s. %s" % (nm(b), p, vs, n) for aid, b, p, vs, n in ex["release"]) or "None so far.")
    o.append("\n## 4. Kept provisionally, marked uncertain\n")
    loc = [x for x in ex["uncertain"] if x[1]["batch_id"] in ("B06", "B12")]
    lines = ["- %s: **%s**. %s" % (nm(b), st, n) for aid, b, st, n in ex["uncertain"] if b["batch_id"] not in ("B06", "B12")]
    if loc:
        lines.append("- %d generic monitor/laptop classes and typical paper or book trims are marked **estimated** by design: they stand for a kind of screen or a "
                     "common size, not one product (%s)." % (len(loc), ", ".join(b["name"] for aid, b, st, n in loc)))
    o.append("\n".join(lines) or "None so far.")
    o.append("\n## 5. Proposed renames, category changes, splits and merges (need approval and RENAMED entries)\n")
    lines = ["- %s: rename to `%s` (new ID `%s`). %s" % (nm(b), n, slug(n), why) for aid, b, n, why in ex["rename"]]
    lines += ["- %s: category %s -> %s. %s" % (nm(b), b["type"], c, n) for aid, b, c, n in ex["category"]]
    lines += ["- %s: %s proposed. %s" % (nm(b), a, n) for aid, b, a, n in ex["structure"]]
    groups = collections.defaultdict(list)
    for m in md:
        if m["decision"] == "GROUP":
            groups[m["existing_equivalent"]].append(m["device_name"])
    lines += ["- %s: same screen also in %s (add to the name, or leave as is)." % (nm(base[t]), ", ".join(v)) for t, v in groups.items() if t in base]
    o.append("\n".join(lines) or "None so far.")
    o.append("\n## 6. Open issues raised by the researchers\n")
    keep = [i for i in issues if i.get("issue_type") not in ("SOURCE_UNAVAILABLE",)]
    dec = {r["id"]: r for r in read_csv(os.path.join(AUDIT, "decisions.csv"))} if os.path.exists(os.path.join(AUDIT, "decisions.csv")) else {}
    o.append("\n".join("- %s %s (%s): %s%s" % (i.get("related_id", ""), i.get("device_name", ""), i.get("issue_type", ""), (i.get("explanation") or "")[:300],
                        " **Ruled:** %s" % dec[i["related_id"]]["note"] if i.get("related_id") in dec else "") for i in keep) or "None.")
    o.append("\n## 7. Differences ignored as rounding (under 0.5%)\n")
    o.append("\n".join("- %s: %s\" kept (research %s\", %.2f%%)" % (nm(b), a, c, dv * 100) for aid, b, a, c, dv in ex["ignored"]) or "None so far.")
    o.append("\n## 8. Automatic checks\n")
    sev = collections.Counter(i["severity"] for i in F.items)
    o.append("`validate_db.py` on the proposal: %d errors, %d warnings, %d notes. Details in `VALIDATION.md`.\n" % (sev["ERROR"], sev["WARN"], sev["INFO"]))
    for i in F.items:
        if i["severity"] in ("ERROR", "WARN"):
            o.append("- %s %s `%s`: %s" % (i["severity"], i["audit_id"], i["name"], i["detail"]))
    o.append("\n## 9. Not researched yet\n")
    by = collections.defaultdict(int)
    for aid, b in ex["open"]:
        by[b["batch_id"]] += 1
    o.append(", ".join("%s: %d" % (k, v) for k, v in sorted(by.items())) or "Nothing: every original row has been researched.")
    open(os.path.join(OUT, "EXCEPTIONS.md"), "w", encoding="utf-8").write("\n".join(o) + "\n")


def write_missing(md, by_id):
    o = ["# Proposed missing-device additions", "", "From `missing_devices_verified.csv`. Decisions: **ADD** (in the proposed list), **GROUP** (same screen as an existing row: "
         "add the model to that row's name, which needs a RENAMED entry), **OPTIONAL** (not added unless wanted), **QUEUE** (announced or unconfirmed: never added yet), **SKIP**.", ""]
    for dec, title in (("ADD", "Added to the proposed list"), ("GROUP", "Same screen as an existing row"), ("OPTIONAL", "Optional, not added"),
                       ("QUEUE", "Review queue (not released or not confirmed)"), ("SKIP", "Skipped")):
        v = [m for m in md if m["decision"] == dec]
        if not v:
            continue
        o.append("## %s (%d)\n" % (title, len(v)))
        o.append("| ID | Device | Type | Diagonal | Pixels | PPI | Status | Note |\n|---|---|---|---:|---|---:|---|---|")
        for m in v:
            g = geom({"diagonal": m["verified_diagonal"], "width": m["width_px"], "height": m["height_px"]})
            name = m["proposed_name"] if dec == "ADD" else m["device_name"]
            note = ("-> %s `%s`" % (m["existing_equivalent"], by_id[m["existing_equivalent"]]["name"])) if dec == "GROUP" and m["existing_equivalent"] in by_id else (m.get("reason_for_inclusion") or "")[:120]
            o.append("| %s | %s | %s | %s | %s x %s | %s | %s %s | %s |" % (m["new_id"], name.replace("|", "/"), m["category"], fmt(m["verified_diagonal"]), fmt(m["width_px"]), fmt(m["height_px"]),
                                                                       "%.0f" % g[0] if g else "-", m["verification_status"], m["product_status"], note.replace("|", "/")))
        o.append("")
    open(os.path.join(OUT, "MISSING_DEVICES_SUMMARY.md"), "w", encoding="utf-8").write("\n".join(o) + "\n")


if __name__ == "__main__":
    sys.exit(main())
