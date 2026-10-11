"""AAICBI wordmark directions in the platform's own palette and typeface (Manrope ExtraBold, SIL OFL), as outlined SVG.
Run: python3 docs/brand/v2/build_wordmark.py   (needs fonttools; Manrope woff from the @fontsource/manrope npm package)"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "svg")
FONT = TTFont(os.environ.get("MANROPE", "/tmp/fonts/package/files/manrope-latin-800-normal.woff"))
SEMI = TTFont(os.environ.get("MANROPE_SEMI", "/tmp/fonts/package/files/manrope-latin-700-normal.woff"))
UPM = FONT["head"].unitsPerEm
CMAP, GS = FONT.getBestCmap(), FONT.getGlyphSet()

LIGHT = dict(word="#014A43", accent="#016B61", soft="#85C79A", gold="#D99A34", sub="#4B6660", bg="#F7F5F0")
DARK = dict(word="#E8F0ED", accent="#4FBBA8", soft="#9AD4AC", gold="#E3AC55", sub="#A9BFB8", bg="#14181A")
MONO = dict(word="#014A43", accent="#014A43", soft="#014A43", gold="#014A43", sub="#014A43", bg="#FFFFFF")
MONOW = dict(word="#FFFFFF", accent="#FFFFFF", soft="#FFFFFF", gold="#FFFFFF", sub="#FFFFFF", bg="#014A43")

def f(n): return ("%.2f" % n).rstrip("0").rstrip(".")

def contours(font, ch, scale, x, y):
    """Split a glyph into separate closed contours (as path strings) so the dot of an i can be coloured on its own."""
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    rec = RecordingPen(); gs[cmap[ord(ch)]].draw(TransformPen(rec, (scale, 0, 0, -scale, x, y)))
    out, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            out.append(cur); cur = []
    from fontTools.pens.boundsPen import BoundsPen
    paths = []
    for c in out:
        p, bp = SVGPathPen(None), BoundsPen(None)
        for op, args in c: getattr(p, op)(*args); getattr(bp, op)(*args)
        paths.append((p.getCommands(), bp.bounds))
    return paths

def word(text, size, track=0.012, step=0.0, font=FONT):
    """Lay out text. Returns list of (kind, d) with kind 'body' or 'dot', total width, x-height, and per-letter centres.
    The i's dot is taken from the font's own glyph. step raises each following letter by step*size."""
    scale = size / UPM
    cmap, hmtx = font.getBestCmap(), font["hmtx"]
    x, parts, centres = 0.0, [], []
    for i, ch in enumerate(text):
        adv = hmtx[cmap[ord(ch)]][0] * scale
        dy = -i * step * size
        cs = contours(font, ch, scale, x, dy)
        if ch == "i":
            # the contour with the smallest y (highest on screen) is the dot
            cs_sorted = sorted(cs, key=lambda c: c[1][1])  # smallest y = highest on screen = the dot
            x0_, y0_, x1_, y1_ = cs_sorted[0][1]
            cx, cy, r = (x0_ + x1_) / 2, (y0_ + y1_) / 2, (x1_ - x0_) / 2 * 1.08
            circ = f"M{f(cx-r)} {f(cy)}a{f(r)} {f(r)} 0 1 0 {f(2*r)} 0a{f(r)} {f(r)} 0 1 0 {f(-2*r)} 0Z"
            parts.append(("dot", circ)); parts += [("body", d) for d, _ in cs_sorted[1:]]
        else:
            parts += [("body", d) for d, _ in cs]
        centres.append(x + adv / 2)
        x += adv + (track * size if i < len(text) - 1 else 0)
    return parts, x, FONT["OS/2"].sxHeight * scale, centres

def paths(parts, col, dotcols):
    """dotcols: list of colours for successive dots."""
    o, k = [], 0
    for kind, d in parts:
        if kind == "dot":
            o.append(f'<path d="{d}" fill="{dotcols[min(k, len(dotcols)-1)]}"/>'); k += 1
        else:
            o.append(f'<path d="{d}" fill="{col}"/>')
    return "".join(o)

def svg(w, h, body, vb_x=0, vb_y=0, bg=None):
    r = f'<rect x="{f(vb_x)}" y="{f(vb_y)}" width="{f(w)}" height="{f(h)}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(vb_x)} {f(vb_y)} {f(w)} {f(h)}" role="img" aria-label="AAICBI">{r}{body}</svg>'

S = 100  # font size in drawing units
TEXT = "aaicbi"

def dir_route(t):
    """Stitched route: a dashed line (shoe stitching, footpath) under the word that lifts at the toe; the last i's dot is the destination."""
    parts, W, xh, _ = word(TEXT, S)
    y0 = 24
    stitch = f'<path d="M2 {y0} H{f(W-30)} Q{f(W-4)} {y0} {f(W+6)} {f(y0-34)}" fill="none" stroke="{t["accent"]}" stroke-width="4" stroke-linecap="butt" stroke-dasharray="13 9"/>'
    body = paths(parts, t["word"], [t["soft"] if t is not MONO and t is not MONOW else t["word"], t["gold"]]) + stitch
    return body, W + 14, S * 0.74 + y0 + 8, -(S * 0.74) 

def dir_steps(t):
    """Rising steps: every letter stands a little higher than the one before it."""
    parts, W, xh, _ = word(TEXT, S, step=0.034)
    body = paths(parts, t["word"], [t["soft"] if t is not MONO and t is not MONOW else t["word"], t["gold"]])
    rise = 5 * 0.034 * S
    return body, W, S * 0.74 + rise + 6, -(S * 0.74 + rise)

def dir_sole(t):
    """Sole: the word stands on a slim sole with an upturned toe and a stitched line along it."""
    parts, W, xh, _ = word(TEXT, S)
    y0 = 22
    sole = f'<path d="M5 {y0} H{f(W-26)} Q{f(W-4)} {y0} {f(W+8)} {f(y0-20)}" fill="none" stroke="{t["accent"]}" stroke-width="9" stroke-linecap="round"/>'
    stitch = f'<path d="M14 {y0} H{f(W-30)}" fill="none" stroke="{t["gold"] if t not in (MONO, MONOW) else t["bg"]}" stroke-width="2" stroke-linecap="butt" stroke-dasharray="6 6"/>'
    body = paths(parts, t["word"], [t["soft"] if t is not MONO and t is not MONOW else t["word"], t["gold"]]) + sole + stitch
    return body, W + 16, S * 0.74 + y0 + 8, -(S * 0.74)

DIRS = {"route": dir_route, "steps": dir_steps, "sole": dir_sole}

def build_word(name, t):
    body, w, h, top = DIRS[name](t)
    # allow ascender (i dot / b stem) headroom
    pad_t = 6
    return svg(w, h + pad_t, f'<g transform="translate(0 {f(-top + pad_t)})">{body}</g>')

def symbol(name, t, tile=None):
    """The letter 'a' on its own with the direction's device, for icons and avatars (square 64 grid)."""
    size = 64 * 0.82
    parts, W, xh, _ = word("a", size, track=0)
    x0 = (64 - W) / 2; ytop = 64 * 0.46 + xh / 2
    body = "".join(f'<path transform="translate({f(x0)} {f(ytop)})" d="{d}" fill="{t["word"]}"/>' for _, d in parts)
    base = ytop + 6
    if name == "route":
        dev = f'<path d="M14 {f(base)} H40 Q51 {f(base)} 54 {f(base-12)}" fill="none" stroke="{t["accent"]}" stroke-width="2.6" stroke-linecap="butt" stroke-dasharray="6 4.5"/>'
    elif name == "sole":
        dev = f'<path d="M14 {f(base)} H40 Q51 {f(base)} 54 {f(base-9)}" fill="none" stroke="{t["accent"]}" stroke-width="5" stroke-linecap="round"/>'
    else:
        dev = ""
    dot = f'<circle cx="{f(x0+W+1)}" cy="{f(ytop - xh - 1)}" r="3.6" fill="{t["gold"]}"/>'
    g = f'<g>{body}{dev}{dot}</g>'
    if tile:
        return svg(64, 64, f'<rect width="64" height="64" rx="15" fill="{tile}"/>' + g)
    return svg(64, 64, g)

def lockup(name, t):
    """Tier 2: wordmark with the full name set small beside it (formal use)."""
    body, w, h, top = DIRS[name](t)
    pad_t = 6
    txt = "AFRICA’S AI CAPACITY BUILDING INITIATIVE"
    # two lines, semibold caps, tracked
    l1, l2 = "AFRICA’S AI CAPACITY", "BUILDING INITIATIVE"
    size = 15.5; scale = size / UPM
    def run(s, y):
        x, d = 0.0, []
        cmap, hm = SEMI.getBestCmap(), SEMI["hmtx"]; gs = SEMI.getGlyphSet()
        for i, ch in enumerate(s):
            adv = hm[cmap[ord(ch)]][0] * scale
            if ch != " ":
                pen = SVGPathPen(gs); gs[cmap[ord(ch)]].draw(TransformPen(pen, (scale, 0, 0, -scale, x, y))); d.append(pen.getCommands())
            x += adv + 0.14 * size
        return " ".join(d), x - 0.14 * size
    d1, w1 = run(l1, 0); d2, w2 = run(l2, 24)
    gap = 34
    bx = w + gap
    bar = f'<rect x="{f(w+gap/2-1)}" y="{f(pad_t)}" width="2" height="{f(h-8)}" rx="1" fill="{t["soft"] if t not in (MONO, MONOW) else t["sub"]}"/>'
    ty = pad_t + (h - 4) / 2 - 8
    text = f'<g transform="translate({f(bx)} {f(ty)})"><path d="{d1}" fill="{t["sub"]}"/><path d="{d2}" fill="{t["sub"]}"/></g>'
    W = bx + max(w1, w2)
    return svg(W, h + pad_t, f'<g transform="translate(0 {f(-top + pad_t)})">{body}</g>{bar}{text}')

def write(n, s): open(os.path.join(OUT, n), "w").write(s)

THEMES = {"": LIGHT, "-dark": DARK, "-mono": MONO, "-mono-white": MONOW}
for name in DIRS:
    for suf, t in THEMES.items():
        write(f"aaicbi-wordmark-{name}{suf}.svg", build_word(name, t))
        write(f"aaicbi-formal-{name}{suf}.svg", lockup(name, t))
    write(f"aaicbi-symbol-{name}.svg", symbol(name, LIGHT))
    write(f"aaicbi-app-icon-{name}.svg", symbol(name, dict(LIGHT, word="#FFFFFF", accent="#85C79A", gold="#F0B95B"), tile="#016B61"))
    write(f"aaicbi-app-icon-{name}-dark.svg", symbol(name, dict(DARK, word="#14181A", accent="#14181A", gold="#7A4E0B"), tile="#4FBBA8"))
print(sorted(os.listdir(OUT))[:6], len(os.listdir(OUT)))
