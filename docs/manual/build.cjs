// Builds the manual PDFs from the content files: node docs/manual/build.cjs [org|trainee|combined]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { chromium } = require('../../node_modules/playwright-core');
const lib = require('./src/lib.cjs');
const css = fs.readFileSync(path.join(__dirname, 'src/style.css'), 'utf8');
const OUT = path.join(__dirname, 'output');
const VERSION = '1.0', DATE = '20 October 2026';
const svg = (f) => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(__dirname, 'assets', f)).toString('base64');
const load = (f) => { const full = path.join(__dirname, 'src', f); delete require.cache[require.resolve(full)]; return require(full); };

const MANUALS = {
  org: { file: 'AAICBI Training Organisation User Manual v1.0.pdf', audience: 'For training organisations', title: 'AAICBI Ecosystem — Training Organisation User Manual', cover: ['Training Organisation', 'User Manual'], sub: 'A Practical Guide to Managing Your Organisation, Trainees, Courses, and Platform Activities', parts: [{ title: null, src: './content/org.cjs' }] },
  trainee: { file: 'AAICBI Trainee User Manual v1.0.pdf', audience: 'For trainees', title: 'AAICBI Ecosystem — Trainee User Manual', cover: ['Trainee', 'User Manual'], sub: 'A Step-by-Step Guide to Getting Started, Learning, Connecting, and Tracking Your Progress', parts: [{ title: null, src: './content/trainee.cjs' }] },
  tech: { file: 'AAICBI Ecosystem Technology and Architecture Guide v1.0.pdf', audience: 'For leadership, partners and technical reviewers', title: 'AAICBI Ecosystem — Technology and Architecture Guide', cover: ['Technology and', 'Architecture Guide'], sub: 'The tools behind the platform, how the Game Studio, Certificate Studio and every engine work, and why each choice was made', tailTitle: 'Open items and how to verify this guide', coverNote: 'Prepared from the platform’s source code, documentation and tests. Where a reason is written in the code it is quoted; where it is not, the guide says so.', frontNote: 'Tap or click any entry to jump to it. Each decision is labelled <b>Written rationale</b> (the reason is recorded in the code or documents), <b>Engineering inference</b> (our reading of why it fits) or <b>No written rationale</b>.', basis: 'The source code, documentation and automated tests of the AAICBI Ecosystem repository on the date above. Behaviour was read from the code; it was not load-tested.', shotsNote: 'Screenshots in this guide are real screens from a test environment with demonstration accounts and sample data.', closing: 'Numbers such as test counts, page counts and thresholds are taken from the repository at the publication date and will change as the platform grows.', parts: [{ title: null, src: './content/tech.cjs' }] },
  combined: { file: 'Combined AAICBI Ecosystem User Manual v1.0.pdf', audience: 'Training organisations and trainees', title: 'AAICBI Ecosystem User Manual', cover: ['AAICBI Ecosystem', 'User Manual'], sub: 'Part A for training organisations · Part B for trainees', parts: [{ title: 'Part A — Training Organisation User Manual', src: './content/org.cjs', prefix: 'A' }, { title: 'Part B — Trainee User Manual', src: './content/trainee.cjs', prefix: 'B' }] },
};

function html(m, pages) {
  lib.resetFigures();
  const parts = m.parts.map((p) => ({ ...p, chapters: load(p.src).chapters(lib, p.prefix) }));
  const glossary = [...new Map(parts.flatMap((p) => load(p.src).glossary).map(([t, d]) => [t, d])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const toc = [];
  for (const p of parts) {
    if (p.title) toc.push(`<li class="part">${lib.md(p.title)}</li>`);
    for (const c of p.chapters) {
      toc.push(`<li><span class="n">${c.no}</span><a href="#${c.id}">${lib.md(c.title)}</a><span class="dots"></span><span class="pg">${pages[c.id] || ''}</span></li>`);
    }
  }
  for (const [id, t] of [['glossary', 'Glossary'], ['support', m.tailTitle || 'Getting help'], ['revisions', 'Document information and revision history']]) toc.push(`<li><span class="n"></span><a href="#${id}">${t}</a><span class="dots"></span><span class="pg">${pages[id] || ''}</span></li>`);
  const cover = `<section class="cover"><svg class="pat" viewBox="0 0 210 297" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#7fe0cf" stroke-width=".35">${Array.from({ length: 14 }, (_, i) => `<circle cx="${190 - i * 3}" cy="20" r="${20 + i * 9}"/>`).join('')}</g></svg>
<img class="logo" src="${svg('aaicbi-primary-horizontal-reverse.svg')}" alt="AAICBI logo"><div class="mini">VERSION ${VERSION} · ${DATE.toUpperCase()}</div>
<div class="gold"></div><div class="aud">${lib.md(m.audience)}</div><h1>${lib.md(m.cover[0])}<br>${lib.md(m.cover[1])}</h1><div class="sub">${lib.md(m.sub)}</div>
<div class="band"></div><div class="meta"><b>Africa’s AI Capacity Building Initiative (AAICBI)</b><br>Organised by Futybills Tech Community<br>Document version ${VERSION} · Published ${DATE}<br>${m.coverNote || 'Prepared against the live platform; screenshots use demonstration accounts and sample data.'}</div></section>`;
  const front = `<section class="fm"><h2>Contents</h2><ul class="toc">${toc.join('')}</ul><p style="margin-top:8mm;font-size:9.2pt;color:#4a5e59">${m.frontNote || 'Tap or click any entry to jump to it. Numbered red circles on the screenshots match the numbered steps and keys next to them. Every task follows the same pattern: <b>Task, Purpose, Before you begin, Steps, Expected result, If it does not work.</b>'}</p></section>`;
  const body = parts.map((p) => (p.title ? `<section class="chapter" style="text-align:center;padding-top:80mm"><h2 style="font-size:30pt">${lib.md(p.title)}</h2></section>` : '') + p.chapters.map((c) => c.html).join('')).join('');
  const support = m.parts.length > 1 ? require('./src/content/common.cjs').supportBody(lib, 'both') : load(m.parts[0].src).support(lib);
  const tail = `<section class="chapter" id="glossary"><div class="chap-head"><h2>Glossary</h2></div><dl class="gl">${glossary.map(([t, d]) => `<dt>${lib.md(t)}</dt><dd>${lib.md(d)}</dd>`).join('')}</dl></section>
<section class="chapter" id="support"><div class="chap-head"><h2>${m.tailTitle || 'Getting help'}</h2></div>${support}</section>
<section class="chapter" id="revisions"><div class="chap-head"><h2>Document information and revision history</h2></div>
${lib.table(['Item', 'Detail'], [['Document', m.title], ['Version', VERSION], ['Published', DATE], ['Prepared for', m.audience], ['Basis', m.basis || 'The AAICBI Ecosystem as it runs in the organisation’s own environment on the date above. Features that are planned but not available are not described as available.'], ['Screenshots', m.shotsNote || 'Real screens captured at 1440 × 900 (computer) and 390 × 844 (phone) from a test environment with demonstration accounts and sample data. Names, courses and numbers are examples only.']])}
${lib.table(['Version', 'Date', 'Change'], [[VERSION, DATE, 'First edition.']])}
<p>${m.closing || 'Screens change as the platform improves. If a screen differs from a figure in this manual, the written steps and labels still describe the same task; please report the difference using the contact details to be confirmed by AAICBI.'}</p></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${lib.md(m.title)}</title><style>${css.replace(/url\(\.\.\/assets/g, 'url(file://' + __dirname + '/assets')}</style></head><body>${cover}${front}${body}${tail}</body></html>`;
}

async function render(br, m, pages) {
  const page = await br.newPage();
  const h = html(m, pages);
  fs.writeFileSync(path.join(OUT, `${m.key}.html`), h);
  await page.goto('file://' + path.join(OUT, `${m.key}.html`), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(OUT, m.file);
  const hf = (t) => `<div style="font-family:Helvetica,Arial,sans-serif;font-size:7.6pt;color:#4a5e59;width:100%;padding:0 18mm;display:flex;justify-content:space-between">${t}</div>`;
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, tagged: true, outline: true,
    headerTemplate: hf(`<span style="color:#005650;font-weight:bold">AAICBI Ecosystem</span><span>${m.title.replace('AAICBI Ecosystem — ', '').replace('AAICBI Ecosystem ', '')} · v${VERSION}</span>`),
    footerTemplate: hf(`<span>Africa’s AI Capacity Building Initiative · Futybills Tech Community</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>`) });
  await page.close();
  return file;
}
function locate(file, m) {
  const n = Number(/Pages:\s+(\d+)/.exec(cp.execSync(`pdfinfo "${file}"`).toString())[1]);
  const text = []; for (let i = 1; i <= n; i++) text[i] = cp.execSync(`pdftotext -f ${i} -l ${i} -layout "${file}" -`).toString();
  const pages = {};
  const parts = m.parts.map((p) => ({ ...p, chapters: load(p.src).chapters(lib, p.prefix) }));
  const find = (id, re, from) => { for (let i = from; i <= n; i++) if (re.test(text[i])) { pages[id] = i; return i; } };
  let toc = 2; while (toc < n && /Contents/.test(text[toc + 1]) && toc < 6) toc++;
  let from = toc + 1;
  for (const p of parts) for (const c of p.chapters) { const words = c.title.replace(/\*\*/g, '').split(/\s+/).slice(0, 3).map((w) => w.replace(/[.*+?^${}()|[\]\\,]/g, '\\$&'));
      const re = new RegExp('(^|\\n)[^\\n]*' + words.join('\\s+'), 'i'); const f = find(c.id, re, from); if (f) from = f; }
  find('glossary', /\n\s*Glossary\s*\n/, from); find('support', new RegExp('\\n\\s*' + (m.tailTitle || 'Getting help').split(' ').slice(0, 3).join('\\s+')), from); find('revisions', /Document information and revision history\s*\n/, from);
  return { pages, n };
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const want = process.argv[2] ? [process.argv[2]] : Object.keys(MANUALS);
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  for (const k of want) {
    const m = { ...MANUALS[k], key: k };
    let file = await render(br, m, {});
    const { pages } = locate(file, m);
    file = await render(br, m, pages);
    const r = locate(file, m);
    console.log(k, r.n + ' pages', JSON.stringify(r.pages).slice(0, 200));
  }
  await br.close();
})();
