#!/usr/bin/env python3
"""Turn attached lesson files (PDF, DOCX, PPTX, TXT, MD) into one source.md for a module.

usage: extract.py OUT.md "Label A=path/a.pdf" "Label B=path/b.docx[:from-to]" ...
For .pptx an optional ":3-12" suffix keeps only those slides; for .pdf an optional ":1-20" keeps only those pages.
Everything is labelled so every item can later be traced to a material.
"""
import re, subprocess, sys

def pdf(path, rng):
    args = ["pdftotext", "-layout"]
    if rng:
        a, b = rng
        args += ["-f", str(a), "-l", str(b)]
    text = subprocess.run(args + [path, "-"], capture_output=True, text=True, check=True).stdout
    text = re.sub(r"[ \t]+", " ", text)
    return "\n".join(l.strip() for l in text.splitlines() if l.strip())

def docx(path, rng):
    import docx
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    d = docx.Document(path)
    out = []
    for block in d.element.body.iterchildren():
        if block.tag.endswith("}p"):
            p = Paragraph(block, d)
            if p.text.strip():
                out.append(("## " if p.style.name.startswith("Heading") else "") + p.text)
        elif block.tag.endswith("}tbl"):
            for r in Table(block, d).rows:
                out.append(" | ".join(c.text.strip().replace("\n", " / ") for c in r.cells))
    return "\n".join(out)

def pptx(path, rng):
    from pptx import Presentation
    out = []
    for i, s in enumerate(Presentation(path).slides, 1):
        if rng and not (rng[0] <= i <= rng[1]):
            continue
        out.append(f"[slide {i}]")
        for sh in s.shapes:
            if sh.has_text_frame and sh.text_frame.text.strip():
                out.append(sh.text_frame.text.strip())
            if getattr(sh, "has_table", False) and sh.has_table:
                for r in sh.table.rows:
                    out.append(" | ".join(c.text for c in r.cells))
        if s.has_notes_slide and s.notes_slide.notes_text_frame.text.strip():
            out.append("NOTES: " + s.notes_slide.notes_text_frame.text)
    return "\n".join(out)

def main():
    out_path, specs = sys.argv[1], sys.argv[2:]
    parts = ["# SOURCE MATERIALS (every question must be answerable from these alone)\n"]
    for n, spec in enumerate(specs):
        label, _, rest = spec.partition("=")
        path, _, rng = rest.partition(":")
        r = tuple(int(x) for x in rng.split("-")) if rng else None
        ext = path.rsplit(".", 1)[-1].lower()
        body = {"pdf": pdf, "docx": docx, "pptx": pptx}.get(ext, lambda p, r: open(p).read())(path, r)
        parts.append(f"\n========== MATERIAL {chr(65 + n)}: {label} ==========\n{body}\n")
    open(out_path, "w").write("".join(parts))
    print(f"wrote {out_path}: {sum(len(p) for p in parts)} characters")

main()
