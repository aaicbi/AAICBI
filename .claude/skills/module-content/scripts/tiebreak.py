#!/usr/bin/env python3
"""Settle disputed quiz/scenario answers with a third blind check (options shuffled).
usage: tiebreak.py build    -> writes tiebreak/packet.json (+source.md) from score.json and tiebreak_key.json
       tiebreak.py check    -> reads tiebreak/result.json and prints which disputed items the checker did NOT agree with the key on"""
import json, os, random, shutil, sys

if sys.argv[1] == "build":
    random.seed(5)
    sc = json.load(open("score.json")); tb, km = [], {}
    for n in sorted(int(k) for k in sc):
        d = json.load(open(f"obj{n}.json"))
        for sid in sc[str(n)]["mismatch"]:
            if sid[0] not in "qs": continue
            arr = "scenario" if sid[0] == "s" else "quiz"; s = d[arr][int(sid[1:])]
            if arr == "scenario": opts = [o["text"] for o in s["options"]]; c = [o["correct"] for o in s["options"]].index(True); text = s["situation"]
            else: opts = s["options"]; c = s["correct"]; text = s["question"]
            order = list(range(len(opts))); random.shuffle(order); tid = f"o{n}{sid}"
            tb.append({"id": tid, "situation": text, "options": [opts[j] for j in order]}); km[tid] = order.index(c)
    shutil.rmtree("tiebreak", ignore_errors=True); os.makedirs("tiebreak")
    json.dump({"items": tb}, open("tiebreak/packet.json", "w"), indent=1); json.dump(km, open("tiebreak_key.json", "w")); shutil.copy("source.md", "tiebreak/source.md")
    print(len(tb), "disputed items")
else:
    key = json.load(open("tiebreak_key.json")); r = json.load(open("tiebreak/result.json")); a = r["answers"]
    bad = [k for k in key if a.get(k) != key[k]]
    print(f"checker agrees with the key on {len(key) - len(bad)} of {len(key)}")
    for k in bad: print(" disagreement:", k, "checker", a.get(k), "key", key[k], "|", r.get("notes", {}).get(k, "")[:200])
