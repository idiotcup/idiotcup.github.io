"""Consistency checks on data/idiot_cup.json. Run after every update.

Prints FAIL lines for hard errors and WARN lines for data gaps worth a look.
Exit code 1 if any FAIL.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((ROOT / "data" / "idiot_cup.json").read_text(encoding="utf-8"))
fails, warns = [], []
known = set(d["players"]["core"]) | set(d["players"]["others"])

for t in d["trips"]:
    y, att = t["year"], set(t["attendees"])
    if t["golfers"] and len(att) != t["golfers"]:
        warns.append(f"{y}: {len(att)} attendees on grid vs {t['golfers']} golfers listed")
    for p in t["belt"]["champs"]:
        if p not in att:
            fails.append(f"{y}: belt champ {p} not marked as attending")
    rc = t["rc"]
    for p in rc["caps"]:
        if p in known and p not in att:
            fails.append(f"{y}: captain {p} not marked as attending")
    for p in rc["side"]:
        if p not in att:
            fails.append(f"{y}: {p} has RC team result but is not marked as attending")
    if rc["pts"]:
        # Points need not balance: one-off guests are not tracked individually
        for p, (w, l) in rc["pts"].items():
            if p not in att:
                fails.append(f"{y}: {p} has RC pts but is not marked as attending")
            side = rc["side"].get(p)
            if side is None:
                warns.append(f"{y}: {p} has RC pts but no team W/L")
    if rc["matches"]:
        a = sum(m["pa"] for m in rc["matches"] if set(m["a"]) <= set(rc["teams"][rc["winner"]]))
        b = sum(m["pb"] for m in rc["matches"] if set(m["b"]) <= set(rc["teams"][rc["winner"]]))
        if rc["score"] and abs(a + b - rc["score"][0]) > 1e-9:
            fails.append(f"{y}: winning team match pts {a + b} != stated score {rc['score'][0]}")
        for m in rc["matches"]:
            if abs(m["pa"] + m["pb"] - (2 if len(m["a"]) == 2 else 1)) > 1e-9:
                fails.append(f"{y} day {m['day']}: {m['a']} v {m['b']} pts do not sum to match value")
    if rc["winner"] and rc["side"]:
        # A captain with no recorded side is a gap, not a contradiction
        for c in rc["caps"]:
            expect = "W" if c == rc["winner"] else "L"
            if rc["side"].get(c, expect) != expect:
                fails.append(f"{y}: captain {c} is on the {rc['side'][c]} side but the Cup result says {expect}")
    c = t["calcutta"]
    if c:
        for p in c["owners"]:
            if p not in att:
                warns.append(f"{y}: Calcutta owner {p} not marked as attending")
    if t["ctp"]:
        for day in t["ctp"]:
            for p in day["wins"]:
                if p not in att:
                    fails.append(f"{y}: CTP winner {p} not marked as attending")
    for p in att:
        if p not in known:
            fails.append(f"{y}: unknown player {p}")

# Spot check against the 2026 summary totals
ctp = dict(d["ctpBefore2026"])
for t in d["trips"]:
    for day in t["ctp"] or []:
        for p, v in day["wins"].items():
            ctp[p] = ctp.get(p, 0) + v
expected = {"Soto": 17, "Barrett": 7.5, "Josh": 16, "Geoff": 11, "Stephan": 6.5, "EJ": 5, "Geno": 5,
            "Gy": 9, "Gil": 5, "Eddie C": 7, "Chris D": 2, "Lamont": 11}
for p, v in expected.items():
    if ctp.get(p) != v:
        fails.append(f"CTP lifetime {p}: computed {ctp.get(p)} vs summary {v}")

# Acknowledged data problems (meta.knownIssues) are shown on the site, not re-reported here
acked = [k["key"] for k in d["meta"].get("knownIssues", [])]
warns = [w for w in warns if not any(w.startswith(k) for k in acked)]
fails = [f for f in fails if not any(f.startswith(k) for k in acked)]
for w in warns:
    print("WARN", w)
for f in fails:
    print("FAIL", f)
print(f"{len(fails)} fail, {len(warns)} warn")
sys.exit(1 if fails else 0)
