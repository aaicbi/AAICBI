#!/usr/bin/env python3
"""Build blind review packets (NO answer keys) from objN.json. usage: packet.py [seed]   (run in the work folder)
Reads objectives.json (list of objective texts) and obj1.json..objN.json.
Writes review/packetN.json + review/objectiveN.txt + review/source.md for the reviewers, and keyN.json (private, outside review/)."""
import json, os, random, shutil, sys

random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
objectives = json.load(open("objectives.json"))
shutil.rmtree("review", ignore_errors=True)
os.makedirs("review")
shutil.copy("source.md", "review/source.md")
for n in range(1, len(objectives) + 1):
    d = json.load(open(f"obj{n}.json"))
    pk = {"objective": n, "quiz": [], "matching": [], "ordering": [], "scenario": []}
    key = {"quiz": [], "matching": [], "ordering": [], "scenario": []}
    for i, q in enumerate(d["quiz"]):
        pk["quiz"].append({"id": f"q{i}", "question": q["question"], "options": q["options"]}); key["quiz"].append(q["correct"])
    for i, q in enumerate(d["matching"]):
        rights = [p["right"] for p in q["pairs"]]; random.shuffle(rights)
        pk["matching"].append({"id": f"m{i}", "prompt": q["prompt"], "lefts": [p["left"] for p in q["pairs"]], "rights_shuffled": rights})
        key["matching"].append([p["right"] for p in q["pairs"]])
    for i, q in enumerate(d["ordering"]):
        s = q["steps"][:]
        for _ in range(5):
            random.shuffle(s)
            if s != q["steps"]: break
        pk["ordering"].append({"id": f"o{i}", "prompt": q["prompt"], "steps_shuffled": s}); key["ordering"].append(q["steps"])
    for i, q in enumerate(d["scenario"]):
        pk["scenario"].append({"id": f"s{i}", "situation": q["situation"], "options": [o["text"] for o in q["options"]]})
        key["scenario"].append([o["correct"] for o in q["options"]].index(True))
    json.dump(pk, open(f"review/packet{n}.json", "w"), indent=1)
    json.dump(key, open(f"key{n}.json", "w"))
    open(f"review/objective{n}.txt", "w").write(objectives[n - 1])
print("packets written for", len(objectives), "objectives")
