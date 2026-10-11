"""AAICBI logo, Nested Ascent mark in the platform's own colours, with a Manrope ExtraBold wordmark (outlined SVG).
Tier 1 = symbol + wordmark; tier 2 = formal lockup with the full name beside it. Run: python3 docs/brand/v3/build_logo.py"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(__file__); OUT = os.path.join(HERE, "svg")
BOLD = TTFont(os.environ.get("MANROPE", "/tmp/fonts/package/files/manrope-latin-800-normal.woff"))
SEMI = TTFont(os.environ.get("MANROPE_SEMI", "/tmp/fonts/package/files/manrope-latin-700-normal.woff"))

# Platform tokens (src/app/globals.css): light = teal / teal-deep / green / gold, dark = the dark theme's values.
THEMES = {
    "": dict(big="#014A43", small="#85C79A", node="#D99A34", word="#014A43", sub="#4B6660", rule="#85C79A"),
    "-dark": dict(big="#E8F0ED", small="#4FBBA8", node="#E3AC55", word="#E8F0ED", sub="#A9BFB8", rule="#4FBBA8"),
    "-mono": dict(big="#014A43", small="#014A43", node="#014A43", word="#014A43", sub="#014A43", rule="#014A43"),
    "-mono-white": dict(big="#FFFFFF", small="#FFFFFF", node="#FFFFFF", word="#FFFFFF", sub="#FFFFFF", rule="#FFFFFF"),
}
if os.environ.get("SMALL"): THEMES[""]["small"] = os.environ["SMALL"]

def f(n): return ("%.2f" % n).rstrip("0").rstrip(".")
def pts(p): return " ".join(f(x) + "," + f(y) for x, y in p)

import math
K = 1 / math.sqrt(3)  # leg slope (dx per dy) of an equilateral triangle: 30 degrees off vertical

def chevron(cx, base, half, ta, tw):
    """A flat-topped chevron whose outer legs run at 60 degrees (the side of an equilateral triangle). y grows downward."""
    top = base - (half - ta / 2) / K
    yi = base - (half - tw) / K
    return [(cx - half, base), (cx - ta / 2, top), (cx + ta / 2, top), (cx + half, base), (cx + half - tw, base), (cx, yi), (cx - half + tw, base)]

def mark(cx, base, half):
    """The Nested Ascent mark: big chevron, a second chevron nested inside it at an even gap, and one node on the baseline."""
    ta, tw = 0.09 * half, 0.357 * half
    half2, tw2, ta2 = half - 1.5 * tw, 0.6 * tw, 0.045 * half
    return chevron(cx, base, half, ta, tw), chevron(cx, base, half2, ta2, tw2), (cx, base - 0.1125 * half, 0.1125 * half)

BIG, SMALL, DOT = mark(32, 55, 28)   # on a 64 grid: apex near y 9, feet at y 55

def symbol_group(t, dx=0, dy=0, s=1):
    return (f'<g transform="translate({f(dx)} {f(dy)}) scale({f(s)})"><polygon points="{pts(BIG)}" fill="{t["big"]}"/>'
            f'<polygon points="{pts(SMALL)}" fill="{t["small"]}"/><circle cx="{f(DOT[0])}" cy="{f(DOT[1])}" r="{f(DOT[2])}" fill="{t["node"]}"/></g>')

def run(font, text, size, tracking):
    gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
    sc = size / upm; x = 0.0; d = []
    for i, ch in enumerate(text):
        n = cmap[ord(ch)]; adv = font["hmtx"][n][0] * sc
        if ch != " ":
            pen = SVGPathPen(gs, ntos=f); gs[n].draw(TransformPen(pen, (sc, 0, 0, -sc, x, 0))); d.append(pen.getCommands())
        x += adv + (tracking * size if i < len(text) - 1 else 0)
    return " ".join(d), x
def ink_extent(font, text, size, tracking):
    """Left and right edge of the drawn letters (not their advance boxes), for aligning the mark to the word."""
    from fontTools.pens.boundsPen import BoundsPen
    gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
    sc = size / upm; x = 0.0; lo, hi = 1e9, -1e9
    for i, ch in enumerate(text):
        n = cmap[ord(ch)]; bp = BoundsPen(gs); gs[n].draw(bp)
        if bp.bounds: lo = min(lo, x + bp.bounds[0] * sc); hi = max(hi, x + bp.bounds[2] * sc)
        x += font["hmtx"][n][0] * sc + (tracking * size if i < len(text) - 1 else 0)
    return lo, hi

def cap(font, size): return font["OS/2"].sCapHeight * size / font["head"].unitsPerEm
def svg(w, h, body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" role="img" aria-label="AAICBI">{body}</svg>'

WSIZE = 36
def horizontal(t, formal=False):
    d, ww = run(BOLD, "AAICBI", WSIZE, 0.06); ch = cap(BOLD, WSIZE)
    x0 = 64 + 18; ty = (64 - ch) / 2 + ch
    body = symbol_group(t) + f'<path transform="translate({f(x0)} {f(ty)})" d="{d}" fill="{t["word"]}"/>'
    W = x0 + ww
    if formal:
        l1, w1 = run(SEMI, "AFRICA’S AI CAPACITY", 11.5, 0.14); l2, w2 = run(SEMI, "BUILDING INITIATIVE", 11.5, 0.14)
        gap = 30; bx = W + gap
        body += f'<rect x="{f(W+gap/2-1)}" y="10" width="2" height="44" rx="1" fill="{t["rule"]}"/>'
        c = cap(SEMI, 11.5); y1 = 32 - 6; y2 = y1 + c + 10
        body += f'<g transform="translate({f(bx)} 0)"><path transform="translate(0 {f(y1)})" d="{l1}" fill="{t["sub"]}"/><path transform="translate(0 {f(y2)})" d="{l2}" fill="{t["sub"]}"/></g>'
        W = bx + max(w1, w2)
    return svg(W, 64, body)

def stacked(t, formal=False):
    d, ww = run(BOLD, "AAICBI", WSIZE, 0.06); ch = cap(BOLD, WSIZE)
    W = max(ww, 150); S = 1.5; sw = 64 * S
    body = symbol_group(t, (W - sw) / 2, 0, S); y = sw + 24 + ch
    body += f'<path transform="translate({f((W-ww)/2)} {f(y)})" d="{d}" fill="{t["word"]}"/>'; H = y
    if formal:
        l, lw = run(SEMI, "AFRICA’S AI CAPACITY BUILDING INITIATIVE", 1.0, 0.12)
        size = ww / lw; l, lw = run(SEMI, "AFRICA’S AI CAPACITY BUILDING INITIATIVE", size, 0.12)
        y2 = y + 16 + cap(SEMI, size)
        body += f'<path transform="translate({f((W-lw)/2)} {f(y2)})" d="{l}" fill="{t["sub"]}"/>'; H = y2
    return svg(W, H + 2, body)

PSIZE, PTRACK, PGAP = 40, 0.14, 9
def pyramid_geometry():
    """The whole lockup sits inside one equilateral triangle. The word is the base row; the triangle is widened just enough that nothing
    in the word crosses its sides: the binding point is the top-right corner of the final I, so each side starts cap-height*tan(30deg) outside the word."""
    d, ww = run(BOLD, "AAICBI", PSIZE, PTRACK); lo, hi = ink_extent(BOLD, "AAICBI", PSIZE, PTRACK); ch = cap(BOLD, PSIZE)
    m = ch * K + 0.6                             # horizontal room each side needs (0.6 units of clearance)
    B = (hi - lo) + 2 * m; Ht = B * math.sqrt(3) / 2; cx = (lo + hi) / 2; x0 = lo - m
    y_s = Ht - ch - PGAP                         # the mark's feet stand just above the word
    half = B / 2 - (Ht - y_s) * K                # the mark's outer legs lie on the triangle's sides
    big, small, dot = mark(cx, y_s, half)
    return dict(d=d, ww=ww, lo=lo, hi=hi, ch=ch, B=B, Ht=Ht, cx=cx, x0=x0, m=m, big=big, small=small, dot=dot, top=big[1][1])

def inside_margin(g):
    """Smallest distance (in units, measured horizontally) from any letter outline point to the triangle's sides; negative would mean overflow."""
    from fontTools.pens.recordingPen import RecordingPen
    gs, cmap, upm = BOLD.getGlyphSet(), BOLD.getBestCmap(), BOLD["head"].unitsPerEm
    sc = PSIZE / upm; x = 0.0; worst = 1e9
    for i, ch_ in enumerate("AAICBI"):
        n = cmap[ord(ch_)]; rec = RecordingPen(); gs[n].draw(rec)
        for op, args in rec.value:
            for (px, py) in args:                        # on-curve and control points: a safe (convex-hull) test
                X, Y = x + px * sc, py * sc             # Y is height above the baseline
                left = g["cx"] - g["B"] / 2 + Y * K; right = g["cx"] + g["B"] / 2 - Y * K
                worst = min(worst, X - left, right - X)
        x += BOLD["hmtx"][n][0] * sc + (PTRACK * PSIZE if i < 5 else 0)
    return worst

def pyramid(t, formal=False):
    """Primary lockup: mark above the word; together they fill one equilateral triangle (the mark's legs extended, and the word's baseline, are its sides)."""
    g = pyramid_geometry(); dy = -g["top"]; tx = -g["x0"]
    body = (f'<g transform="translate({f(tx)} {f(dy)})"><polygon points="{pts(g["big"])}" fill="{t["big"]}"/><polygon points="{pts(g["small"])}" fill="{t["small"]}"/>'
            f'<circle cx="{f(g["dot"][0])}" cy="{f(g["dot"][1])}" r="{f(g["dot"][2])}" fill="{t["node"]}"/>'
            f'<path transform="translate(0 {f(g["Ht"])})" d="{g["d"]}" fill="{t["word"]}"/></g>')
    H = g["Ht"] - g["top"]
    if formal:
        txt = "AFRICA\u2019S AI CAPACITY BUILDING INITIATIVE"
        l, lw = run(SEMI, txt, 1.0, 0.12); size = (g["hi"] - g["lo"]) / lw; l, lw = run(SEMI, txt, size, 0.12)
        y2 = g["Ht"] + 20 + cap(SEMI, size)
        body += f'<g transform="translate({f(tx)} {f(dy)})"><path transform="translate({f(g["lo"])} {f(y2)})" d="{l}" fill="{t["sub"]}"/></g>'; H += 20 + cap(SEMI, size)
    return svg(g["B"], H + 2, body)

def tile(bg, t, pad=0.2, rounded=True, S=512):
    sc = S * (1 - 2 * pad) / 64
    return svg(S, S, f'<rect width="{S}" height="{S}" rx="{f(S*0.22) if rounded else 0}" fill="{bg}"/>' + symbol_group(t, S * pad, S * pad, sc))

def w(n, s): open(os.path.join(OUT, n), "w").write(s)
for suf, t in THEMES.items():
    w(f"aaicbi-symbol{suf}.svg", svg(64, 64, symbol_group(t)))
    w(f"aaicbi-logo{suf}.svg", pyramid(t))                     # tier 1, primary: mark above the word (pyramid)
    w(f"aaicbi-formal{suf}.svg", pyramid(t, True))             # tier 2, primary with the full name beneath, for formal use
    w(f"aaicbi-logo-compact{suf}.svg", horizontal(t))          # tier 1, compact horizontal for tight bars
    w(f"aaicbi-formal-compact{suf}.svg", horizontal(t, True))  # tier 2, compact horizontal with the name beside it
ICON_T = dict(big="#FFFFFF", small="#85C79A", node="#F0B95B")  # on the platform teal tile
w("aaicbi-app-icon.svg", tile("#016B61", ICON_T))
w("aaicbi-app-icon-maskable.svg", tile("#016B61", ICON_T, pad=0.27, rounded=False))
w("aaicbi-app-icon-dark.svg", tile("#14181A", dict(big="#E8F0ED", small="#4FBBA8", node="#E3AC55")))
print(len(os.listdir(OUT)))

# The outlined artwork as TypeScript constants, so the app's <Logo> can draw it in any theme colour.
d1, w1 = run(BOLD, "AAICBI", WSIZE, 0.06); c1 = cap(BOLD, WSIZE)
g = pyramid_geometry(); dy = -g["top"]
def P(poly): return " ".join(f(x - g["x0"]) + "," + f(y + dy) for x, y in poly)
ts = os.path.join(HERE, "..", "..", "..", "src", "components", "brand", "wordmark.ts")
os.makedirs(os.path.dirname(ts), exist_ok=True)
open(ts, "w").write(f"""// Generated by docs/brand/v3/build_logo.py (Manrope ExtraBold, SIL OFL, converted to outlines). Do not edit by hand.
// The mark on a 64-unit grid (symbol and compact lockup).
export const MARK_BIG = "{pts(BIG)}";
export const MARK_SMALL = "{pts(SMALL)}";
export const MARK_DOT = {{ cx: {f(DOT[0])}, cy: {f(DOT[1])}, r: {f(DOT[2])} }};
// Compact lockup: the word that sits beside the mark.
export const WORDMARK_PATH = "{d1}";
export const WORDMARK_WIDTH = {f(w1)};
export const WORDMARK_CAP_HEIGHT = {f(c1)};
// Pyramid lockup: the mark stands on the word and both sit inside one equilateral triangle.
export const PYRAMID_WIDTH = {f(g["B"])};
export const PYRAMID_HEIGHT = {f(g["Ht"] - g["top"] + 2)};
export const PYRAMID_BIG = "{P(g["big"])}";
export const PYRAMID_SMALL = "{P(g["small"])}";
export const PYRAMID_DOT = {{ cx: {f(g["dot"][0] - g["x0"])}, cy: {f(g["dot"][1] + dy)}, r: {f(g["dot"][2])} }};
export const PYRAMID_PATH = "{g["d"]}";
export const PYRAMID_WORD_X = {f(-g["x0"])};
export const PYRAMID_WORD_Y = {f(g["Ht"] + dy)};
""")

print("smallest clearance between any letter point and the triangle (units):", round(inside_margin(g), 2))
