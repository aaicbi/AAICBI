"""Builds docs/brand/v2/wordmark-board.html (self-contained) from the SVGs. Run build_wordmark.py first."""
import os
HERE = os.path.dirname(__file__)
def svg(name, style=""):
    s = open(os.path.join(HERE, "svg", name)).read()
    return s.replace("<svg ", f'<svg style="{style}" ', 1)

D = {
 "route": ("A · Stitched route", "A dashed line runs under the word like the stitching on a shoe and like a footpath on a map, then lifts at the end. The last i's dot is the destination; the first is where you start.", "Lightest and most word-like. The dashes vanish below about 100 px wide, so small uses lose the idea."),
 "sole": ("B · Sole", "The word stands on a slim sole with an upturned toe and a stitched line along it. A sole is the part that protects the foot on the road, and the toe lifts like a path rising.", "Boldest and the clearest shoe-and-road story. The solid line survives at small sizes, only the stitching drops out."),
 "steps": ("C · Rising steps", "Each letter stands a little higher than the one before, so the word climbs like steps. Growth with no extra drawing.", "Simplest, but at a glance it looks like a baseline mistake and the story is the hardest to see."),
}
def card(k, pick=False):
    title, story, note = D[k]
    sizes = "".join(f'<div class="sz">{svg(f"aaicbi-wordmark-{k}.svg", f"width:{w}px")}<span>{w}px</span></div>' for w in (200, 120, 80))
    return f'''<section class="card{" pick" if pick else ""}"><div class="hd"><h2>{title}</h2>{'<b class="tag">Recommended</b>' if pick else ''}</div><p>{story}</p><p class="n">{note}</p>
<div class="r2"><div class="pn light">{svg(f"aaicbi-wordmark-{k}.svg","width:min(100%,380px)")}</div><div class="pn dark">{svg(f"aaicbi-wordmark-{k}-dark.svg","width:min(100%,380px)")}</div></div>
<div class="r3"><div class="pn light small"><div class="szs">{sizes}</div><i>Small sizes</i></div><div class="pn light small tiles">{svg(f"aaicbi-app-icon-{k}.svg","width:64px")}{svg(f"aaicbi-app-icon-{k}-dark.svg","width:64px")}{svg(f"aaicbi-symbol-{k}.svg","width:44px")}<i>App icon, symbol</i></div></div>
<div class="pn light formal">{svg(f"aaicbi-formal-{k}.svg","width:min(100%,640px)")}<i>Tier 2, formal lockup (letterheads, certificates, investor decks)</i></div></section>'''

CSS = """:root{--teal:#016B61;--deep:#014A43;--mint:#E4EEE7;--gold:#D99A34;--ink:#16302B;--sand:#F7F5F0;--line:#D8E2DC}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font-family:Manrope,Inter,system-ui,Arial,sans-serif;line-height:1.55}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}header.top{background:var(--deep);color:#fff;padding:48px 0}header.top h1{margin:0 0 8px;font-size:36px;line-height:1.15;letter-spacing:-.01em}header.top p{margin:6px 0;color:#CFE3DB;max-width:720px}
.eyebrow{font-size:12px;letter-spacing:.14em;color:#9AD4AC;font-weight:800;margin:0 0 8px}
.tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:26px 0 0}.tiers div{background:rgba(255,255,255,.08);border-radius:16px;padding:14px 16px;font-size:14px;color:#E8F0ED}.tiers b{display:block;color:#fff;margin-bottom:2px}
h2{margin:0;font-size:22px}.card{border:1px solid var(--line);border-radius:24px;padding:24px;margin:26px 0;background:#fff}.card.pick{border:2px solid var(--teal)}.hd{display:flex;gap:12px;align-items:center}.tag{background:var(--teal);color:#fff;border-radius:999px;padding:3px 12px;font-size:12px}
.card p{margin:8px 0;max-width:760px}.n{color:#4B6660;font-size:14px}
.r2{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-top:14px}.r3{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-top:12px}
.pn{border-radius:18px;padding:28px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:16px;position:relative}.pn.light{background:var(--sand);border:1px solid var(--line)}.pn.dark{background:#14181A}.pn.small{padding:20px 16px 30px}.pn i{position:absolute;bottom:8px;left:14px;font:600 11px Manrope,sans-serif;color:#6B8079;font-style:normal}
.szs{display:flex;gap:22px;align-items:flex-end;flex-wrap:wrap}.pn svg{max-width:100%;height:auto}.mh svg{max-width:60%}.sz{display:flex;flex-direction:column;gap:4px;align-items:flex-start}.sz span{font-size:10px;color:#6B8079}.pn.formal{margin-top:12px;padding:34px 24px 40px}
.story,.mock{margin:34px 0}.story{background:var(--mint);border-radius:24px;padding:26px}.story h2{margin-bottom:8px}.story p{max-width:780px;margin:8px 0}
.mockbar{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden}.mh{display:flex;justify-content:space-between;align-items:center;padding:14px 22px;border-bottom:1px solid var(--line);background:#fff}.mh nav{display:flex;gap:20px;font-size:14px;font-weight:600;color:#4B6660;align-items:center}.mh nav b{background:var(--teal);color:#fff;border-radius:999px;padding:8px 18px}.mb{padding:36px 22px;background:linear-gradient(180deg,var(--sand),#fff)}.mb h3{margin:0 0 6px;font-size:28px;max-width:560px;line-height:1.2}.mb p{max-width:520px;color:#4B6660;margin:0}
.ask{background:var(--sand);border:1px solid var(--line);border-radius:24px;padding:24px;margin:30px 0 60px}.ask li{margin:6px 0}
@media(max-width:820px){.tiers,.r2,.r3{grid-template-columns:1fr}header.top h1{font-size:28px}.mh nav span{display:none}}"""

html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AAICBI wordmark directions</title><style>{CSS}</style></head><body>
<header class="top"><div class="wrap"><p class="eyebrow">BRAND V2 · WORDMARK DIRECTIONS</p><h1>aaicbi, said &ldquo;Ayak-bi&rdquo;.</h1><p>The name is a word you say, close to the Turkish <i>ayakkabı</i> (shoe). The mark tells the story it carries: the platform is what a person wears to protect their feet on a journey of self-development.</p>
<div class="tiers"><div><b>Tier 1 · Everyday logo</b>The wordmark alone. No descriptor underneath.</div><div><b>Tier 2 · Formal lockup</b>The wordmark with &ldquo;Africa&rsquo;s AI Capacity Building Initiative&rdquo; set small beside it.</div><div><b>Tier 3 · The story</b>The shoe and journey narrative lives on the about page, never on the logo.</div></div></div></header>
<div class="wrap">
<div class="story"><h2>Why it works as a word</h2><p>Lowercase letters make AAICBI read as a name rather than a code, and they bring two natural dots: the first i marks where a person starts, the last (gold) marks where the journey is heading. The letters are set in <b>Manrope ExtraBold</b>, the platform&rsquo;s own typeface, and the colours are the platform&rsquo;s deep teal, mint-green and gold, so the logo already belongs to the pages it sits on.</p><p>The chevron mark from the first round survives only as an optional idea; none of these directions uses it.</p></div>
{card("sole", True)}{card("route")}{card("steps")}
<div class="mock"><h2 style="margin-bottom:10px">In the platform header (direction B)</h2><div class="mockbar"><div class="mh">{svg("aaicbi-wordmark-sole.svg","height:34px")}<nav><span>Learn</span><span>Community</span><span>Opportunities</span><b>Join</b></nav></div><div class="mb"><h3>Grow at your own pace, on a road others have walked.</h3><p>Courses, community and opportunities for Africa&rsquo;s AI talent.</p></div></div></div>
<div class="ask"><h2>What I need from you</h2><ol><li>Pick a direction (my recommendation is B, Sole).</li><li>Check the Turkish: is <i>ayakkabı</i> the spelling and meaning you intend? A Turkish speaker should confirm before the story is published.</li><li>Tell me if the gold i-dot should stay (destination) or whether you prefer all dots in one colour.</li></ol><p class="n">Nothing in the platform has changed yet. After you choose, I will replace the logo in the header, emails, certificates, app icons and favicon, and update the manifest.</p></div>
</div></body></html>'''
open(os.path.join(HERE, "wordmark-board.html"), "w").write(html)
print(len(html))
