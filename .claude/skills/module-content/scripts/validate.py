#!/usr/bin/env python3
"""Structure check for objN.json files. usage: validate.py obj1.json obj2.json ...  (run in the work folder)
Rules: quiz and scenario exactly 20; matching 16-20; ordering 10-20 (drop weak items rather than pad); texts within platform limits; no duplicates."""
import collections, json, sys

MINS = {"quiz": 20, "scenario": 20, "matching": 16, "ordering": 10}
MAX = 20

def check(path):
    e = []
    d = json.load(open(path))
    for k, lo in MINS.items():
        if not lo <= len(d.get(k, [])) <= MAX:
            e.append(f"{k}: need {lo}-{MAX}, have {len(d.get(k, []))}")
    seen = collections.Counter()
    for i, q in enumerate(d.get("quiz", [])):
        t = f"quiz[{i}]"
        if not isinstance(q.get("question"), str) or not 10 <= len(q["question"]) <= 300: e.append(t + " question length")
        o = q.get("options", [])
        if len(o) != 4 or len({x.strip().lower() for x in o}) != 4 or any(not x.strip() or len(x) > 300 for x in o): e.append(t + " needs 4 distinct options <=300 chars")
        if q.get("correct") not in (0, 1, 2, 3): e.append(t + " correct must be 0-3")
        if not q.get("explanation"): e.append(t + " explanation missing")
        seen["q|" + q.get("question", "").strip().lower()] += 1
    for i, q in enumerate(d.get("matching", [])):
        t = f"matching[{i}]"; p = q.get("pairs", [])
        if not 4 <= len(p) <= 5: e.append(t + " need 4-5 pairs")
        L = [x["left"].strip().lower() for x in p]; R = [x["right"].strip().lower() for x in p]
        if len(set(L)) != len(L) or len(set(R)) != len(R): e.append(t + " duplicate left/right")
        if any(len(x["left"]) > 300 or len(x["right"]) > 300 or not x["left"].strip() or not x["right"].strip() for x in p): e.append(t + " pair text")
        if not q.get("prompt"): e.append(t + " prompt")
        seen["m|" + q.get("prompt", "").strip().lower() + "|" + "|".join(sorted(L))] += 1
    for i, q in enumerate(d.get("ordering", [])):
        t = f"ordering[{i}]"; s = q.get("steps", [])
        if not 4 <= len(s) <= 6 or len({x.strip().lower() for x in s}) != len(s) or any(len(x) > 300 for x in s): e.append(t + " need 4-6 distinct steps")
        if not q.get("prompt"): e.append(t + " prompt")
        seen["o|" + "|".join(x.strip().lower() for x in s)] += 1
    for i, q in enumerate(d.get("scenario", [])):
        t = f"scenario[{i}]"; o = q.get("options", [])
        if not isinstance(q.get("situation"), str) or not 20 <= len(q["situation"]) <= 800: e.append(t + " situation length")
        if not 3 <= len(o) <= 4: e.append(t + " need 3-4 options")
        if sum(1 for x in o if x.get("correct") is True) != 1: e.append(t + " exactly one correct")
        if any(not x.get("text") or not x.get("outcome") or len(x["text"]) > 300 for x in o): e.append(t + " option text/outcome")
        seen["s|" + q.get("situation", "").strip().lower()] += 1
    e += ["duplicate: " + k[:70] for k, c in seen.items() if c > 1]
    return e, d

bad = 0
for p in sys.argv[1:]:
    e, d = check(p)
    pos = collections.Counter(q.get("correct") for q in d.get("quiz", []))
    print(p, "OK" if not e else "PROBLEMS", {k: len(d.get(k, [])) for k in MINS}, "quiz answer positions", dict(pos))
    for m in e[:30]:
        print("  -", m); bad += 1
sys.exit(1 if bad else 0)
