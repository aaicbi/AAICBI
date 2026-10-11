"""Builds docs/brand/brand-guide.html (self-contained) from the SVG artwork. Run build_logo.py first."""
import os, re
HERE = os.path.dirname(__file__)
def svg(name, cls="", style=""):
    s = open(os.path.join(HERE, "svg", name)).read()
    s = s.replace('<svg ', f'<svg class="{cls}" style="{style}" ', 1)
    return s
OLD = open(os.path.join(HERE, "..", "..", "public", "logo.svg")).read().replace('width="40" height="40"', 'width="72" height="72"')

NAVY, TEAL, TEAL_L, AMBER = "#0B1F3A", "#0E9490", "#2DD4CF", "#F2A33A"

# three concept sketches (simple, same 64 grid)
C_A = f'<svg viewBox="0 0 64 64"><polygon points="32,6 60,58 50,58 32,21 14,58 4,58" fill="{NAVY}"/><polygon points="32,34 45,58 39,58 32,44 25,58 19,58" fill="{TEAL}"/><circle cx="32" cy="54.8" r="3.2" fill="{AMBER}"/></svg>'
C_B = f'<svg viewBox="0 0 64 64" fill="none"><g stroke="{NAVY}" stroke-width="7"><path d="M32 8a24 24 0 0 1 20.8 12"/><path d="M52.8 44A24 24 0 0 1 32 56"/><path d="M11.2 44A24 24 0 0 1 11.2 20" stroke="{TEAL}"/></g><circle cx="32" cy="32" r="5" fill="{AMBER}"/></svg>'
C_C = f'<svg viewBox="0 0 64 64"><g stroke="{NAVY}" stroke-width="2.4" stroke-linecap="round"><path d="M32 12 18 32 8 52M32 12l14 20 10 20M18 32h28M8 52h48"/></g><g fill="{NAVY}"><circle cx="18" cy="32" r="4"/><circle cx="46" cy="32" r="4"/><circle cx="8" cy="52" r="4"/><circle cx="56" cy="52" r="4"/></g><circle cx="32" cy="12" r="5" fill="{AMBER}"/><circle cx="32" cy="52" r="4" fill="{TEAL}"/></svg>'

# construction drawing
CONS = f'''<svg viewBox="-6 -2 92 70" class="cons"><g stroke="#9FB3C8" stroke-width=".35" fill="none"><rect x="4" y="6" width="56" height="52"/><line x1="32" y1="0" x2="32" y2="64" stroke-dasharray="1.5 1.5"/><line x1="0" y1="34" x2="64" y2="34" stroke-dasharray="1.5 1.5"/><line x1="0" y1="58" x2="64" y2="58"/><line x1="0" y1="6" x2="64" y2="6"/></g>
<polygon points="32,6 35,6 60,58 50,58 32,20.56 14,58 4,58 29,6" fill="{NAVY}" opacity=".92"/><polygon points="30.5,34 33.5,34 45.04,58 39.04,58 32,43.36 24.96,58 18.96,58" fill="{TEAL}"/><circle cx="32" cy="54.8" r="3.2" fill="{AMBER}"/>
<g font-size="2.6" fill="#5B6B7F" font-family="Inter,Arial,sans-serif"><text x="61" y="9">flat apex</text><text x="61" y="36">2nd chevron</text><text x="61" y="57">one baseline</text></g></svg>'''

def lock(name, bg, w, pad="28px"):
    return f'<div class="tile" style="background:{bg};padding:{pad}">{svg(name, style=f"width:{w}px;max-width:100%")}</div>'

def row(title, files, note=""):
    cells = "".join(lock(n, bg, w) for n, bg, w in files)
    return f'<h4>{title}</h4><p class="note">{note}</p><div class="grid3">{cells}</div>'

SYSTEM = (
 row("Primary logo (symbol, wordmark, full name), horizontal", [("aaicbi-primary-horizontal.svg","#fff",300),("aaicbi-primary-horizontal-reverse.svg",NAVY,300),("aaicbi-primary-horizontal-mono.svg","#fff",300)], "For websites, documents, signage and any place there is room for the full name.")
 + row("Primary logo, stacked", [("aaicbi-primary-stacked.svg","#fff",190),("aaicbi-primary-stacked-reverse.svg",NAVY,190),("aaicbi-primary-stacked-mono-white.svg","#14507A",190)], "For covers, posters, conference backdrops and square or portrait spaces.")
 + row("Secondary logo (symbol and wordmark)", [("aaicbi-secondary-horizontal.svg","#fff",240),("aaicbi-secondary-horizontal-reverse.svg",NAVY,240),("aaicbi-secondary-horizontal-mono-white.svg","#0E9490",240)], "For headers, app bars, email signatures and anywhere the full name would be too small to read.")
 + row("Standalone symbol", [("aaicbi-symbol.svg","#fff",96),("aaicbi-symbol-reverse.svg",NAVY,96),("aaicbi-symbol-mono.svg","#EEF2F6",96)], "Favicons, profile images, app icons, watermarks.")
)

ICONS = f'''<div class="grid4">
<div class="tile" style="background:#EEF2F6">{svg("aaicbi-app-icon.svg",style="width:112px")}<p class="cap">App icon, dark</p></div>
<div class="tile" style="background:#EEF2F6">{svg("aaicbi-app-icon-light.svg",style="width:112px;border:1px solid #D5DCE4;border-radius:25px")}<p class="cap">App icon, light</p></div>
<div class="tile" style="background:#EEF2F6">{svg("aaicbi-app-icon-maskable.svg",style="width:112px;border-radius:50%")}<p class="cap">Maskable (cropped to a circle)</p></div>
<div class="tile" style="background:#EEF2F6;gap:14px">{svg("aaicbi-symbol.svg",style="width:48px")}{svg("aaicbi-symbol.svg",style="width:32px")}{svg("aaicbi-symbol.svg",style="width:20px")}{svg("aaicbi-symbol.svg",style="width:16px")}<p class="cap" style="width:100%">48 / 32 / 20 / 16 px</p></div></div>'''

SW = lambda hexv,name,role,txt: f'<div class="sw"><div class="chip" style="background:{hexv};color:{txt}">{hexv}</div><b>{name}</b><span>{role}</span></div>'
PALETTE = '<div class="grid5">' + SW("#0B1F3A","Midnight","Primary. Wordmark, large fields, dark backgrounds","#fff") + SW("#0E9490","Signal Teal","Technology. Second chevron on light","#fff") + SW("#2DD4CF","Signal Teal Light","Second chevron on dark only","#0B1F3A") + SW("#F2A33A","Savanna Amber","The single accent: the node. Never text","#0B1F3A") + SW("#EEF2F6","Mist","Neutral backgrounds and panels","#0B1F3A") + '</div>'

def usage_tile(style, label, file="aaicbi-primary-horizontal.svg", bg="#fff", w=220, extra=""):
    return f'<div class="bad"><div class="tile" style="background:{bg};height:120px;{extra}">{svg(file, style=f"width:{w}px;max-width:90%;{style}")}</div><p><span class="x">✕</span> {label}</p></div>'
BAD = '<div class="grid4">' + "".join([
 usage_tile("transform:scaleX(1.5)","Do not stretch or squash"),
 usage_tile("transform:rotate(-12deg)","Do not rotate or tilt"),
 usage_tile("filter:hue-rotate(150deg) saturate(2)","Do not change the colours"),
 usage_tile("filter:drop-shadow(4px 6px 3px rgba(0,0,0,.45))","Do not add shadows or glows"),
 usage_tile("opacity:.35","Do not use low contrast", bg="#fff"),
 usage_tile("", "Do not place on busy images", bg="repeating-linear-gradient(45deg,#7aa 0 10px,#d96 10px 20px,#456 20px 30px)"),
 usage_tile("", "Do not put the colour logo on mid-tone colour", bg="#0E9490"),
 f'<div class="bad"><div class="tile" style="background:#fff;height:120px"><div style="display:flex;gap:26px;align-items:center">{svg("aaicbi-symbol.svg",style="width:34px;transform:scaleX(-1)")}{svg("aaicbi-secondary-horizontal.svg",style="width:150px;transform:translateY(10px)")}</div></div><p><span class="x">✕</span> Do not rearrange, mirror or re-space the parts</p></div>',
]) + '</div>'

CLEAR = f'''<div class="tile" style="background:#fff;padding:0"><div class="clear">{svg("aaicbi-secondary-horizontal.svg",style="width:360px;max-width:100%")}<i class="a">x</i><i class="b">x</i><i class="c">x</i><i class="d">x</i></div></div>'''

# ---- applications (understated mockups) ----
WEB = f'''<div class="browser"><div class="bar"><i></i><i></i><i></i><span>aaicbi.org</span></div>
<div class="site"><header>{svg("aaicbi-secondary-horizontal.svg",style="height:30px")}<nav><span>Ecosystem</span><span>Talent</span><span>Organizations</span><span>Opportunities</span><b>Join</b></nav></header>
<section><p class="eyebrow">AFRICA&rsquo;S AI CAPACITY BUILDING INITIATIVE</p><h3>Where African AI talent meets opportunity.</h3><p>Professionals, institutions, employers, startups and investors, connected in one ecosystem.</p><div><b class="btn">Explore the ecosystem</b><span class="btn ghost">For organizations</span></div></section></div></div>'''
CONF = f'''<div class="conf">{svg("aaicbi-primary-stacked-reverse.svg",style="height:64%;margin-bottom:26px")}<div class="strip"><span>AAICBI Summit</span><span>Lagos · Nairobi · Accra</span><span>aaicbi.org</span></div></div>'''
SLIDE = f'''<div class="slide"><div class="s-top">{svg("aaicbi-secondary-horizontal.svg",style="height:22px")}<span>Partnership briefing</span></div><h3>Building Africa&rsquo;s AI capacity, together.</h3><p>Talent &middot; Institutions &middot; Employers &middot; Startups &middot; Investors</p><div class="s-bar"></div></div>'''
SLIDE2 = f'''<div class="slide dark"><div class="s-top">{svg("aaicbi-secondary-horizontal-reverse.svg",style="height:22px")}<span>Investor overview</span></div><h3>One ecosystem. Four ways to take part.</h3><div class="s-cols"><b>Train</b><b>Hire</b><b>Build</b><b>Invest</b></div></div>'''
LETTER = f'''<div class="letter"><div class="lh">{svg("aaicbi-primary-horizontal.svg",style="height:46px")}</div><p class="d">11 October 2026</p><p><b>Dear Partner,</b></p><p class="l"></p><p class="l"></p><p class="l s"></p><p class="l"></p><p class="l s"></p><div class="lf"><span>Organized by Futybills Tech Community</span><span>aaicbi.org</span></div></div>'''
AVATARS = f'''<div class="avs"><div style="background:{NAVY}">{svg("aaicbi-symbol-reverse.svg",style="width:60%")}</div><div style="background:#fff;border:1px solid #D5DCE4">{svg("aaicbi-symbol.svg",style="width:60%")}</div><div style="background:{TEAL}">{svg("aaicbi-symbol-mono-white.svg",style="width:60%")}</div><div class="sq" style="background:{NAVY}">{svg("aaicbi-symbol-reverse.svg",style="width:60%")}</div></div>'''
PHONE = f'''<div class="phone"><div class="pbar">{svg("aaicbi-secondary-horizontal.svg",style="height:22px")}<i></i></div><div class="pcard"><b>Welcome back</b><span>3 new opportunities match your profile</span></div><div class="pcard"><b>Community</b><span>12 new posts today</span></div><div class="ptabs"><i class="on"></i><i></i><i></i><i></i></div></div>'''
DESK = f'''<div class="desk"><aside>{svg("aaicbi-secondary-horizontal-reverse.svg",style="height:24px")}<i class="on"></i><i></i><i></i><i></i><i></i></aside><main><div class="h"></div><div class="cards"><div></div><div></div><div></div></div><div class="big"></div></main></div>'''
INVEST = f'''<div class="slide inv"><div class="inv-l">{svg("aaicbi-primary-stacked-reverse.svg",style="width:62%")}</div><div class="inv-r"><p class="eyebrow">STRATEGIC PARTNERSHIP</p><h3>Africa&rsquo;s role in the global AI economy</h3><p>Capacity, opportunity, innovation.</p></div></div>'''

CSS = """
:root{--navy:#0B1F3A;--teal:#0E9490;--amber:#F2A33A;--mist:#EEF2F6;--ink:#0B1F3A;--slate:#4A5B70;--line:#D5DCE4}
*{box-sizing:border-box}body{margin:0;font-family:Inter,'Inter Display',system-ui,Arial,sans-serif;color:var(--ink);background:#fff;line-height:1.55}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}section.s{padding:64px 0;border-top:1px solid var(--line)}
h1{font-size:44px;line-height:1.1;margin:0 0 12px;letter-spacing:-.02em}h2{font-size:28px;margin:0 0 8px;letter-spacing:-.01em}h3{margin:0}h4{margin:32px 0 2px;font-size:17px}
.lead{font-size:18px;color:var(--slate);max-width:760px}.note{color:var(--slate);margin:0 0 12px;font-size:14px}.eyebrow{font-size:12px;letter-spacing:.14em;color:var(--teal);font-weight:700;margin:0 0 8px}
.hero{background:var(--navy);color:#fff;padding:72px 0}.hero .lead{color:#B9C6D6}.hero-l{display:grid;grid-template-columns:1.1fr 1fr;gap:32px;align-items:center}.hero .panel{background:#fff;border-radius:16px;padding:40px;display:flex;justify-content:center}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.tile{border-radius:14px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;flex-wrap:wrap;min-height:140px}.tile svg{display:block}.cap{font-size:12px;color:var(--slate);margin:8px 0 0;text-align:center}
.cmp{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.cc{border:1px solid var(--line);border-radius:16px;padding:20px}.cc svg{width:110px;display:block;margin:0 0 12px}.cc.pick{border:2px solid var(--teal);background:#F6FBFB}
.cc h3{font-size:18px}.cc p{font-size:14px;color:var(--slate);margin:6px 0}.sc{font-size:13px;margin-top:10px;display:grid;grid-template-columns:1fr auto;gap:2px 10px}.sc b{font-weight:700}
.sw .chip{height:92px;border-radius:12px;padding:10px;font-weight:700;font-size:14px;display:flex;align-items:flex-end;border:1px solid var(--line)}.sw b{display:block;margin-top:8px}.sw span{font-size:12.5px;color:var(--slate)}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:8px 10px;text-align:left}th{color:var(--slate);font-weight:600}
.bad .tile{overflow:hidden}.bad p{font-size:13px;margin:8px 0 0;color:var(--slate)}.x{color:#B23A48;font-weight:700}
.cons{width:100%;max-width:420px;background:#F6F8FA;border-radius:14px;border:1px solid var(--line)}
.clear{position:relative;padding:21px;display:inline-block;outline:1px dashed #9FB3C8;outline-offset:-1px}.clear svg{outline:1px solid #7AB8B6;display:block}.clear i{position:absolute;font:600 12px Inter,sans-serif;color:var(--teal);font-style:normal}.clear i{font-size:10px;line-height:1;transform:translate(-50%,-50%)}.clear .a{top:10px;left:50%}.clear .b{top:calc(100% - 10px);left:50%}.clear .c{left:10px;top:50%}.clear .d{left:calc(100% - 10px);top:50%}
.flex2{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:center}
.browser{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}.browser .bar{background:var(--mist);padding:8px 12px;display:flex;gap:6px;align-items:center}.browser .bar i{width:9px;height:9px;border-radius:50%;background:#C3CDD8}.browser .bar span{margin-left:14px;font-size:12px;color:var(--slate);background:#fff;border-radius:6px;padding:2px 12px}
.site header{display:flex;justify-content:space-between;align-items:center;padding:16px 28px;border-bottom:1px solid var(--line)}.site nav{display:flex;gap:22px;font-size:13px;color:var(--slate);align-items:center}.site nav b{background:var(--navy);color:#fff;border-radius:999px;padding:6px 16px}
.site section{padding:54px 28px;background:linear-gradient(180deg,#fff,#F4F7FA)}.site h3{font-size:34px;max-width:560px;letter-spacing:-.02em;line-height:1.15}.site p{color:var(--slate);max-width:520px}.btn{display:inline-block;background:var(--navy);color:#fff;border-radius:999px;padding:10px 20px;font-size:14px;margin:6px 10px 0 0}.btn.ghost{background:#fff;color:var(--navy);border:1px solid var(--navy)}
.conf{background:var(--navy);border-radius:14px;aspect-ratio:16/8;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden}.conf .strip{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;padding:10px 24px;font-size:12px;color:#B9C6D6;border-top:1px solid #1D3557}
.slide{background:#fff;border:1px solid var(--line);border-radius:12px;aspect-ratio:16/9;padding:6%;position:relative;overflow:hidden}.slide .s-top{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--slate)}.slide h3{font-size:24px;margin:10% 0 8px;max-width:75%;letter-spacing:-.01em;line-height:1.2}.slide p{font-size:12px;color:var(--slate)}.slide .s-bar{position:absolute;left:0;bottom:0;height:8px;width:100%;background:linear-gradient(90deg,var(--navy) 70%,var(--teal) 70% 92%,var(--amber) 92%)}
.slide.dark{background:var(--navy);border-color:var(--navy);color:#fff}.slide.dark .s-top{color:#B9C6D6}.s-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6%}.s-cols b{border:1px solid #2A4468;border-radius:8px;padding:12px 8px;font-size:12px;text-align:center}
.slide.inv{background:var(--navy);padding:0;display:grid;grid-template-columns:42% 58%}.inv-l{display:flex;align-items:center;justify-content:center;border-right:1px solid #1D3557}.inv-r{padding:8% 7%;color:#fff}.inv-r h3{font-size:20px;margin:6% 0 8px;max-width:100%}.inv-r p{color:#B9C6D6}
.letter{background:#fff;border:1px solid var(--line);border-radius:6px;aspect-ratio:210/297;padding:8% 9%;position:relative;box-shadow:0 2px 10px rgba(11,31,58,.06);max-width:360px}.letter .lh{border-bottom:2px solid var(--navy);padding-bottom:12px;margin-bottom:18px}.letter p{font-size:11px;margin:6px 0}.letter .l{height:6px;background:var(--mist);border-radius:3px}.letter .l.s{width:60%}.letter .lf{position:absolute;left:9%;right:9%;bottom:6%;border-top:1px solid var(--line);padding-top:6px;font-size:9px;color:var(--slate);display:flex;justify-content:space-between}
.avs{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.avs div{width:92px;height:92px;border-radius:50%;display:flex;align-items:center;justify-content:center}.avs .sq{border-radius:20px}
.phone{width:210px;border:8px solid #101A28;border-radius:30px;background:#F4F7FA;padding:14px 12px;height:380px;position:relative;margin:0 auto}.pbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.pbar i{width:18px;height:18px;border-radius:50%;background:var(--navy)}.pcard{background:#fff;border-radius:14px;padding:12px;margin-bottom:10px;border:1px solid var(--line);font-size:12px}.pcard b{display:block}.pcard span{color:var(--slate)}.ptabs{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:18px 18px 0 0;display:flex;justify-content:space-around;padding:12px;border-top:1px solid var(--line)}.ptabs i{width:22px;height:22px;border-radius:50%;background:var(--line)}.ptabs i.on{background:var(--teal)}
.desk{display:grid;grid-template-columns:150px 1fr;border:1px solid var(--line);border-radius:12px;overflow:hidden;height:300px}.desk aside{background:var(--navy);padding:16px 14px}.desk aside i{display:block;height:10px;border-radius:5px;background:#27406A;margin-top:16px}.desk aside i.on{background:var(--teal)}.desk aside svg{margin-bottom:8px}.desk main{background:#F4F7FA;padding:16px}.desk .h{height:14px;width:40%;background:var(--line);border-radius:7px}.desk .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.desk .cards div{height:64px;background:#fff;border:1px solid var(--line);border-radius:10px}.desk .big{height:120px;background:#fff;border:1px solid var(--line);border-radius:10px}
.files td:first-child{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
@media(max-width:820px){.site nav span{display:none}.site section{padding:32px 20px}.desk{grid-template-columns:90px 1fr}.wrap{padding:0 16px}.hero .panel{padding:24px}.tile{padding:16px!important}.hero-l,.cmp,.grid3,.grid5,.flex2,.grid2{grid-template-columns:1fr}.grid4{grid-template-columns:1fr 1fr}h1{font-size:32px}.site h3{font-size:24px}}
@media print{section.s{break-inside:avoid-page}}
"""

html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AAICBI Brand Identity</title><style>{CSS}</style></head><body>
<div class="hero"><div class="wrap hero-l"><div><p class="eyebrow" style="color:#2DD4CF">BRAND IDENTITY, VERSION 1.0 PROPOSAL</p><h1>AAICBI is an ecosystem, not a course site.</h1><p class="lead">A redesigned identity for Africa&rsquo;s AI Capacity Building Initiative, organized by Futybills Tech Community. Nested Ascent: one mark that carries the acronym, upward movement, layered institutions and the single node where talent meets opportunity.</p></div><div class="panel">{svg("aaicbi-primary-stacked.svg",style="width:250px")}</div></div></div>

<div class="wrap">
<section class="s"><p class="eyebrow">1 · ANALYSIS</p><h2>What the current logo says</h2><p class="lead">The present mark is a rounded teal tile holding a mortarboard, with the descriptor &ldquo;Learning Management System&rdquo; beneath the name.</p>
<div class="flex2"><div class="tile" style="background:#F4F7FA;gap:18px;padding:30px"><div>{OLD}</div><div style="font-weight:700;line-height:1.1"><span style="color:#016B61;font-size:22px">AAICBI</span><br><span style="font-size:10px;letter-spacing:.14em;color:#6B7280">LEARNING MANAGEMENT SYSTEM</span></div></div>
<div><table><tr><th>Element</th><th>What it signals</th><th>Decision</th></tr>
<tr><td>Mortarboard</td><td>School, graduation</td><td>Removed</td></tr>
<tr><td>&ldquo;Learning Management System&rdquo;</td><td>Course administration software</td><td>Removed; replaced by the ecosystem&rsquo;s full name</td></tr>
<tr><td>Rounded app tile</td><td>Generic app icon, no ownable shape</td><td>Removed from the logo; used only for app icons</td></tr>
<tr><td>Pale-green accent stroke</td><td>Low contrast, weak at small sizes</td><td>Removed</td></tr>
<tr><td>Teal as the lead colour</td><td>Brand heritage</td><td>Kept, as the supporting colour (brighter) beside midnight navy</td></tr>
<tr><td>The acronym AAICBI</td><td>The name people already know</td><td>Kept, now the dominant element</td></tr></table></div></div></section>

<section class="s"><p class="eyebrow">2 · THREE DIRECTIONS</p><h2>Concepts explored</h2><p class="lead">Three different ideas, not three variations. Scores are a design judgement from 1 (weak) to 5 (strong), made by the designer for this proposal; they are not user-tested.</p>
<div class="cmp">
<div class="cc pick">{C_A}<h3>A · Nested Ascent (selected)</h3><p><b>Idea.</b> The letter A built from geometry alone: a large chevron, a second chevron inside it, and one node. It reads as A and A (Africa, AI), as upward movement, and as layers (people, institutions, industry).</p><p><b>Risk.</b> A chevron can look like a generic &ldquo;up&rdquo; arrow, which the second chevron and the node counter.</p><div class="sc"><span>Sophistication</span><b>5</b><span>Distinctiveness</span><b>4</b><span>Scalability</span><b>5</b><span>Ecosystem relevance</span><b>4</b></div></div>
<div class="cc">{C_B}<h3>B · Open Aperture</h3><p><b>Idea.</b> Three arcs around an open centre, suggesting an iris, a lens, intelligence looking outward, with the node at the centre.</p><p><b>Risk.</b> Close to many existing AI and camera marks; says nothing about Africa or the acronym.</p><div class="sc"><span>Sophistication</span><b>4</b><span>Distinctiveness</span><b>2</b><span>Scalability</span><b>4</b><span>Ecosystem relevance</span><b>3</b></div></div>
<div class="cc">{C_C}<h3>C · Node Lattice</h3><p><b>Idea.</b> A triangle of connected nodes: people and organizations joined in a network, one amber node for opportunity.</p><p><b>Risk.</b> The &ldquo;network of dots&rdquo; is the most common technology cliché, and it breaks down below about 24 px.</p><div class="sc"><span>Sophistication</span><b>3</b><span>Distinctiveness</span><b>2</b><span>Scalability</span><b>2</b><span>Ecosystem relevance</span><b>5</b></div></div>
</div><p class="note" style="margin-top:14px"><b>Why A.</b> It is the only direction that holds up as a 16 px favicon, works as the letter in the name, and carries the ecosystem idea without an obvious technology icon.</p></section>

<section class="s"><p class="eyebrow">3 · THE MARK</p><h2>Nested Ascent</h2>
<div class="flex2"><div>{CONS}</div><div>
<p class="lead" style="font-size:16px"><b>Large chevron (Midnight).</b> The institution of the ecosystem: Africa&rsquo;s AI community as a whole, rising. Its flat apex is a deliberate, print-safe cut rather than a needle point.</p>
<p class="lead" style="font-size:16px"><b>Second chevron (Signal Teal).</b> The layer inside: trainees, professionals, startups and organizations, held by the larger structure and moving up with it. Its legs run parallel to the outer ones, at an even gap.</p>
<p class="lead" style="font-size:16px"><b>Node (Savanna Amber).</b> The single point where talent meets an opportunity, an employer, an investor or a collaborator. It sits on the shared baseline and is the only warm colour in the identity.</p>
<p class="lead" style="font-size:16px"><b>African geometry, used quietly.</b> The triangle and the layered, repeated chevron echo strip-woven and carved patterns found across the continent. They are abstracted, not copied from any single tradition.</p></div></div></section>

<section class="s"><p class="eyebrow">4 · LOGO SYSTEM</p><h2>Artwork</h2><p class="lead">Every lockup comes in colour, reverse, black (mono) and white (mono). The artwork is plain geometry with outlined letters: no gradients, shadows or effects.</p>{SYSTEM}<h4>App icons and small sizes</h4><p class="note">The rounded square exists only as an app-icon container; it is not part of the logo.</p>{ICONS}</section>

<section class="s"><p class="eyebrow">5 · COLOUR</p><h2>Palette</h2><p class="lead">Midnight leads. Teal supports. Amber appears once, as the node. Roughly 70% midnight and neutral, 25% teal, 5% amber.</p>{PALETTE}
<h4>Contrast (WCAG 2.1 ratios, computed)</h4><table><tr><th>Pair</th><th>Ratio</th><th>Use</th></tr><tr><td>Midnight on white</td><td>16.5 : 1</td><td>Any text</td></tr><tr><td>Signal Teal on white</td><td>3.7 : 1</td><td>Graphics and large text only (not body text)</td></tr><tr><td>Signal Teal Light on Midnight</td><td>9.0 : 1</td><td>Any text on dark</td></tr><tr><td>Savanna Amber on Midnight</td><td>7.9 : 1</td><td>Any use on dark</td></tr><tr><td>Savanna Amber on white</td><td>2.1 : 1</td><td>The node only; never text, never a thin line</td></tr></table></section>

<section class="s"><p class="eyebrow">6 · TYPE</p><h2>Typography</h2>
<div class="flex2"><div class="tile" style="background:#fff;padding:36px;display:block"><div style="font:700 56px/1 'Inter Display',Inter,sans-serif;letter-spacing:.07em">AAICBI</div><div style="font:600 12px/1 Inter;letter-spacing:.2em;color:var(--slate);margin-top:14px">AFRICA&rsquo;S AI CAPACITY BUILDING INITIATIVE</div></div>
<div><p class="lead" style="font-size:16px"><b>Wordmark.</b> Inter Display Bold, converted to outlines, with +7% letter-spacing. It is neutral, geometric and legible at small sizes. I kept the standard letter A in the wordmark after testing a bar-less A: it was elegant but read as &ldquo;MICBI&rdquo; at small sizes.</p><p class="lead" style="font-size:16px"><b>Descriptor.</b> Inter Display SemiBold capitals, +12% tracking, sized so the line is exactly as wide as the wordmark.</p><p class="lead" style="font-size:16px"><b>Recommended working fonts.</b> Inter Display for headlines, Inter for text and interfaces (both free under the SIL Open Font License). The platform currently uses Manrope and Fraunces; moving to Inter would be a separate, optional change.</p></div></div></section>

<section class="s"><p class="eyebrow">7 · IN USE</p><h2>Applications</h2><p class="lead">Understated, illustrative mockups drawn in HTML. They show scale and context; they are not production files.</p>
<h4>Ecosystem website</h4>{WEB}
<div class="grid2" style="margin-top:28px"><div><h4 style="margin-top:0">Conference backdrop</h4>{CONF}</div><div><h4 style="margin-top:0">Investor and partnership slide</h4>{INVEST}</div></div>
<div class="grid2" style="margin-top:24px"><div><h4 style="margin-top:0">Corporate slides</h4>{SLIDE}<div style="height:14px"></div>{SLIDE2}</div><div><h4 style="margin-top:0">Letterhead</h4>{LETTER}</div></div>
<div class="grid3" style="margin-top:28px"><div><h4 style="margin-top:0">Social profile images</h4>{AVATARS}</div><div><h4 style="margin-top:0">Mobile</h4>{PHONE}</div><div style="grid-column:span 1"><h4 style="margin-top:0">Desktop</h4>{DESK}</div></div></section>

<section class="s"><p class="eyebrow">8 · USAGE</p><h2>Brand usage guide</h2>
<div class="flex2"><div><h4 style="margin-top:0">Clear space</h4><p class="note">Keep a margin of <b>x</b> on every side, where x is one quarter of the symbol&rsquo;s height. Nothing enters it.</p>{CLEAR}</div>
<div><h4 style="margin-top:0">Minimum size</h4><table><tr><th>Lockup</th><th>Digital</th><th>Print</th></tr><tr><td>Symbol</td><td>16 px high</td><td>5 mm high</td></tr><tr><td>Secondary logo</td><td>96 px wide</td><td>25 mm wide</td></tr><tr><td>Primary logo, horizontal</td><td>220 px wide</td><td>55 mm wide</td></tr><tr><td>Primary logo, stacked</td><td>130 px wide</td><td>35 mm wide</td></tr></table><p class="note" style="margin-top:10px">Below the primary sizes the full name becomes unreadable: switch to the secondary logo, then to the symbol.</p>
<h4>Backgrounds</h4><p class="note">Colour logo on white, Mist or very light neutrals. Reverse on Midnight or any dark with at least 7 : 1 contrast. White (mono) on a single solid brand colour or a photo with a dark overlay. Black (mono, Midnight) for one-colour print, fax, stamps and embossing.</p></div></div>
<h4>Incorrect usage</h4>{BAD}</section>

<section class="s"><p class="eyebrow">9 · FILES</p><h2>What is delivered</h2><p class="lead">All files are in <code>docs/brand/</code>. The SVGs were generated by <code>build_logo.py</code> from the geometry and outlined letterforms; they are real vector files, but I have not opened them in a design application such as Illustrator, and the only PDF is this guide, not a print-ready master of the logo artwork.</p>
<table class="files"><tr><th>File</th><th>Use</th></tr><tr><td>svg/aaicbi-primary-{{horizontal,stacked}}[-reverse|-mono|-mono-white].svg</td><td>Full logo with the organization&rsquo;s name</td></tr><tr><td>svg/aaicbi-secondary-{{horizontal,stacked}}[-reverse|-mono|-mono-white].svg</td><td>Symbol and wordmark</td></tr><tr><td>svg/aaicbi-symbol[-reverse|-mono|-mono-white].svg</td><td>Standalone symbol</td></tr><tr><td>svg/aaicbi-app-icon{{,-light,-maskable}}.svg</td><td>App icons</td></tr><tr><td>png/*.png</td><td>Raster exports, rendered from the SVGs</td></tr><tr><td>brand-guide.html and brand-guide.pdf</td><td>This guide</td></tr><tr><td>build_logo.py, build_guide.py</td><td>Regenerate everything</td></tr></table>
<p class="note" style="margin-top:14px"><b>Not done yet:</b> the platform itself still shows the former logo. Replacing it (header, emails, certificates, app icons, favicon) is a separate step.</p></section>
</div></body></html>'''
open(os.path.join(HERE, "brand-guide.html"), "w").write(html)
print(len(html))
