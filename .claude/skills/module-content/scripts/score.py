#!/usr/bin/env python3
"""Compare reviewers' blind answers with the keys and list every item that needs work. usage: score.py   (run in the work folder)
Reads keyN.json and review/resultN.json. Writes score.json and fixlistN.json (items flagged by a reviewer, or whose ordering/matching
answer differed). Quiz/scenario answer disagreements are NOT sent to the writers: they go to tiebreak.py first, because reviewers
sometimes mis-align or guess their answers (in the first project the key was right on all 35 disputed items)."""
import collections, json

objectives = json.load(open("objectives.json"))
summary, flagged_total, mismatch_total = {}, 0, 0
for n in range(1, len(objectives) + 1):
    key = json.load(open(f"key{n}.json")); r = json.load(open(f"review/result{n}.json")); a = r["answers"]
    mismatch = set()
    for pre, arr in (("q", "quiz"), ("s", "scenario"), ("m", "matching"), ("o", "ordering")):
        for i, k in enumerate(key[arr]):
            if a.get(f"{pre}{i}") != k: mismatch.add(f"{pre}{i}")
    items = {}
    for f in r["flags"]: items.setdefault(f["id"], []).append(f"{f['kind']}: {f['reason']}")
    for i in mismatch:
        if i[0] in "om": items.setdefault(i, []).append("REVIEWER ORDER/MATCH DIFFERED FROM YOUR KEY: the order or pairing is not clearly fixed by the source")
    arr_of = {"q": "quiz", "m": "matching", "o": "ordering", "s": "scenario"}
    fix = [{"id": i, "array": arr_of[i[0]], "index": int(i[1:]), "problems": p} for i, p in sorted(items.items(), key=lambda x: (x[0][0], int(x[0][1:])))]
    json.dump(fix, open(f"fixlist{n}.json", "w"), indent=1)
    summary[n] = {"mismatch": sorted(mismatch), "flags": len(r["flags"]), "fixlist": len(fix), "kinds": dict(collections.Counter(f["kind"] for f in r["flags"]))}
    flagged_total += len(fix); mismatch_total += len(mismatch)
    print(n, "answer mismatches", len(mismatch), "| items to fix", len(fix), "|", summary[n]["kinds"])
json.dump(summary, open("score.json", "w"))
print("total items to fix", flagged_total, "| total answer mismatches", mismatch_total)
