#!/usr/bin/env python3
"""Assemble the reviewed objN.json files into the final module file and print the counts table.
usage: assemble.py "Course title" "Module title" OUT.json     (run in the work folder; reads objectives.json, obj1..N.json)"""
import collections, json, sys

course, module, out_path = sys.argv[1:4]
objectives = json.load(open("objectives.json"))
out = {"course": course, "module": module, "schema": "1",
       "formats": {"quiz": "question, options[4], correct (0-3), explanation", "matching": "prompt, pairs[{left,right}]", "ordering": "prompt, steps[] in correct order", "scenario": "situation, options[{text,outcome,correct}]"},
       "objectives": []}
tot = collections.Counter()
for n, text in enumerate(objectives, 1):
    d = json.load(open(f"obj{n}.json"))
    out["objectives"].append({"number": n, "text": text, **{k: d[k] for k in ("quiz", "matching", "ordering", "scenario")}})
    row = {k: len(d[k]) for k in ("quiz", "matching", "ordering", "scenario")}; tot.update(row)
    print(f"| {n} | {text[:60]} | {row['quiz']} | {row['matching']} | {row['ordering']} | {row['scenario']} |")
print("| | Total |", " | ".join(str(tot[k]) for k in ("quiz", "matching", "ordering", "scenario")), "|")
json.dump(out, open(out_path, "w"), indent=1, ensure_ascii=False)
print("wrote", out_path)
