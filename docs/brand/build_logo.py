"""Builds the AAICBI logo artwork (SVG) from geometry and the outlined letterforms of Inter Display (SIL OFL).
Text is converted to paths, so the SVG files do not depend on any installed font. Run: python3 docs/brand/build_logo.py"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

OUT = os.path.join(os.path.dirname(__file__), "svg")
BOLD = TTFont("/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf")
SEMI = TTFont("/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf")

NAVY, TEAL, TEAL_L, AMBER, WHITE = "#0B1F3A", "#0E9490", "#2DD4CF", "#F2A33A", "#FFFFFF"

def f(n): return ("%.2f" % n).rstrip("0").rstrip(".")
def pts(p): return " ".join(f(x) + "," + f(y) for x, y in p)

def chevron(cx, base, top, half, ta, tw):
    """A flat-topped chevron (an A without its bar). y grows downward."""
    k = (half - ta / 2) / (base - top)
    yi = base - (half - tw) / k
    return [(cx - half, base), (cx - ta / 2, top), (cx + ta / 2, top), (cx + half, base), (cx + half - tw, base), (cx, yi), (cx - half + tw, base)]

BIG = chevron(32, 58, 6, 28, 6, 10)
SMALL = chevron(32, 58, 34, 13.04, 3, 6)
DOT = (32, 54.8, 3.2)

def symbol_group(c1, c2, c3, dx=0, dy=0, s=1):
    t = f"translate({f(dx)} {f(dy)}) scale({f(s)})"
    return (f'<g transform="{t}"><polygon points="{pts(BIG)}" fill="{c1}"/><polygon points="{pts(SMALL)}" fill="{c2}"/>'
            f'<circle cx="{DOT[0]}" cy="{DOT[1]}" r="{DOT[2]}" fill="{c3}"/></g>')

def glyph_run(font, text, size, tracking_em=0.0, barless_a=None):
    """Return (list of path d strings in y-down coordinates with baseline at 0, total advance). Optionally swap A for a bar-less chevron."""
    gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
    sc = size / upm
    x, paths = 0.0, []
    for i, ch in enumerate(text):
        name = cmap[ord(ch)]
        adv = font["hmtx"][name][0] * sc
        if ch == "A" and barless_a:
            capH = font["OS/2"].sCapHeight * sc
            half = adv / 2 - 0.02 * size
            pts_ = chevron(x + adv / 2, 0, -capH, half, barless_a["ta"] * size, barless_a["tw"] * size)
            paths.append("M" + " L".join(f(a) + " " + f(b) for a, b in pts_) + "Z")
        elif ch != " ":
            pen = SVGPathPen(gs)
            gs[name].draw(TransformPen(pen, (sc, 0, 0, -sc, x, 0)))
            paths.append(pen.getCommands())
        x += adv + (tracking_em * size if i < len(text) - 1 else 0)
    return paths, x

def cap(font, size): return font["OS/2"].sCapHeight * size / font["head"].unitsPerEm

AA = dict(ta=0.07, tw=0.215)  # bar-less A, matching the symbol's chevron
def wordmark(size, color, tracking=0.07):
    paths, w = glyph_run(BOLD, "AAICBI", size, tracking)
    return paths, w

def descriptor(width, size, color):
    text = "AFRICA’S AI CAPACITY BUILDING INITIATIVE"
    tr = 0.12  # fixed, even tracking; the size is what makes the line as wide as the wordmark
    _, w1 = glyph_run(SEMI, text, 1.0, tr)
    size = width / w1
    paths, w = glyph_run(SEMI, text, size, tr)
    return paths, w, size

def svg(w, h, body, bg=None):
    r = f'<rect width="{f(w)}" height="{f(h)}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" role="img" aria-label="AAICBI">{r}{body}</svg>'

def path_el(paths, x, y, color): return f'<path transform="translate({f(x)} {f(y)})" d="{" ".join(paths)}" fill="{color}"/>'

THEMES = {
    "color": dict(c1=NAVY, c2=TEAL, c3=AMBER, text=NAVY, sub="#4A5B70", bg=None),
    "reverse": dict(c1=WHITE, c2=TEAL_L, c3=AMBER, text=WHITE, sub="#B9C6D6", bg=None),
    "mono": dict(c1=NAVY, c2=NAVY, c3=NAVY, text=NAVY, sub=NAVY, bg=None),
    "mono-white": dict(c1=WHITE, c2=WHITE, c3=WHITE, text=WHITE, sub=WHITE, bg=None),
}

def build(layout, kind, th):
    t = THEMES[th]
    S = 64
    if layout == "symbol":
        return svg(S, S, symbol_group(t["c1"], t["c2"], t["c3"]))
    if layout in ("horizontal", "horizontal-full"):
        wsize = 38
        wp, ww = wordmark(wsize, t["text"])
        ch = cap(BOLD, wsize)
        sym_h = 64
        sc = 1.0
        gap = 20
        x0 = sym_h + gap
        full = layout == "horizontal-full"
        dp, dw, dsize = descriptor(ww, 0, t["sub"]) if full else (None, 0, 8)
        text_h = ch + (14 + cap(SEMI, dsize) if full else 0)
        ty = (sym_h - text_h) / 2 + ch
        body = symbol_group(t["c1"], t["c2"], t["c3"]) + path_el(wp, x0, ty, t["text"])
        if full: body += path_el(dp, x0, ty + 14 + cap(SEMI, dsize), t["sub"])
        return svg(x0 + ww, sym_h, body)
    if layout in ("stacked", "stacked-full"):
        wsize = 38
        wp, ww = wordmark(wsize, t["text"])
        ch = cap(BOLD, wsize)
        full = layout == "stacked-full"
        W = max(ww, 160)
        symS = 1.55
        symw = 64 * symS
        body = symbol_group(t["c1"], t["c2"], t["c3"], (W - symw) / 2, 0, symS)
        y = symw + 26 + ch
        body += path_el(wp, (W - ww) / 2, y, t["text"])
        H = y
        if full:
            dp, dw, dsize = descriptor(ww, 0, t["sub"])
            y2 = y + 16 + cap(SEMI, dsize)
            body += path_el(dp, (W - dw) / 2, y2, t["sub"])
            H = y2
        return svg(W, H, body)

def write(name, s):
    open(os.path.join(OUT, name), "w").write(s)

for th in THEMES:
    suffix = "" if th == "color" else "-" + th
    write(f"aaicbi-symbol{suffix}.svg", build("symbol", None, th))
    write(f"aaicbi-primary-horizontal{suffix}.svg", build("horizontal-full", None, th))
    write(f"aaicbi-primary-stacked{suffix}.svg", build("stacked-full", None, th))
    write(f"aaicbi-secondary-horizontal{suffix}.svg", build("horizontal", None, th))
    write(f"aaicbi-secondary-stacked{suffix}.svg", build("stacked", None, th))

# App icon (rounded square, safe area for maskable) and favicon-safe symbol
def app_icon(bg, c1, c2, c3, rounded=True, pad=0.22):
    S = 512
    sc = S * (1 - 2 * pad) / 64
    r = S * 0.225 if rounded else 0
    return svg(S, S, f'<rect width="{S}" height="{S}" rx="{f(r)}" fill="{bg}"/>' + symbol_group(c1, c2, c3, S * pad, S * pad, sc))
write("aaicbi-app-icon.svg", app_icon(NAVY, WHITE, TEAL_L, AMBER))
write("aaicbi-app-icon-maskable.svg", app_icon(NAVY, WHITE, TEAL_L, AMBER, rounded=False, pad=0.27))
write("aaicbi-app-icon-light.svg", app_icon("#F4F7FA", NAVY, TEAL, AMBER))
print(sorted(os.listdir(OUT)))
