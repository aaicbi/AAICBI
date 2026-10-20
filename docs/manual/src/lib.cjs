// Building blocks for the manuals: numbered steps, tasks, annotated screenshots, callouts. Content files only call these.
const fs = require('fs'), path = require('path');
const SHOTS = path.join(__dirname, '..', 'screenshots');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Inline markup: **bold** for interface labels, `code` for addresses
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
const img64 = (rel) => { const f = path.join(SHOTS, rel); if (!fs.existsSync(f)) throw new Error('missing screenshot ' + rel); return 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'); };
let figNo = 0;
exports.resetFigures = () => { figNo = 0; };
exports.md = md;

/** One annotated screenshot. marks: [{n,x,y,box:[x,y,w,h]}] in percent of the image. key: [[n,text]] explains each number. */
const ANN = (() => { try { delete require.cache[require.resolve('./marks.cjs')]; return require('./marks.cjs'); } catch { return {}; } })();
function shot(file, o = {}) {
  o = { ...(ANN[file.replace(/\.png$/, '')] || {}), ...o };
  const jf = path.join(SHOTS, file.replace(/\.png$/, '.json'));
  if (!o.marks && fs.existsSync(jf)) { const j = JSON.parse(fs.readFileSync(jf, 'utf8')); o = { ...o, marks: j, key: o.key || j.filter((m) => m.label).map((m) => [m.n, m.label]) }; }
  const kind = /mobile/.test(file) ? 'mobile' : 'desktop';
  const marks = (o.marks || []).map((m) => (m.box ? `<i class="box" style="left:${m.box[0]}%;top:${m.box[1]}%;width:${m.box[2]}%;height:${m.box[3]}%"></i>` : '') + `<b class="badge" style="left:${Math.min(Math.max(m.x, 3.2), 96.8)}%;top:${Math.max(m.y, 2.2)}%">${m.n}</b>`).join('');
  const key = (o.key || []).map(([n, t]) => `<li><b class="badge s">${n}</b><span>${md(t)}</span></li>`).join('');
  return `<figure class="shot ${kind}${o.wide ? ' wide' : ''}"><div class="frame"><img src="${img64(file)}" alt="${esc(o.alt || o.caption || '')}">${marks}</div>${key ? `<ol class="key">${key}</ol>` : ''}${o.noCaption ? '' : `<figcaption><b>Figure ${++figNo}.</b> ${md(o.caption || '')}</figcaption>`}</figure>`;
}
exports.shot = shot;
/** Desktop and phone side by side (the phone is narrower). a and b are options for shot(). */
exports.pair = (fileBase, a = {}, b = {}, caption = '') => {
  const n = ++figNo; figNo = n - 1; // one number for the pair
  const d = shot(fileBase + '-desktop.png', { ...a, noCaption: true }), m = shot(fileBase + '-mobile.png', { ...b, noCaption: true });
  figNo = n;
  return `<figure class="pair"><div class="row"><div class="d">${d}<p class="lab">Desktop (computer)</p></div><div class="m">${m}<p class="lab">Phone</p></div></div><figcaption><b>Figure ${n}.</b> ${md(caption)}</figcaption></figure>`;
};
exports.steps = (list) => `<ol class="steps">${list.map((s) => `<li>${md(s)}</li>`).join('')}</ol>`;
exports.bullets = (list) => `<ul class="bul">${list.map((s) => `<li>${md(s)}</li>`).join('')}</ul>`;
exports.p = (s) => `<p>${md(s)}</p>`;
exports.h3 = (s, id) => `<h3${id ? ` id="${id}"` : ''}>${md(s)}</h3>`;
exports.h4 = (s) => `<h4>${md(s)}</h4>`;
exports.tip = (s) => `<aside class="call tip"><b>Tip</b><p>${md(s)}</p></aside>`;
exports.warn = (s) => `<aside class="call warn"><b>Important</b><p>${md(s)}</p></aside>`;
exports.note = (s) => `<aside class="call note"><b>Limitation</b><p>${md(s)}</p></aside>`;
exports.see = (label, id) => `<a class="xref" href="#${id}">${esc(label)}</a>`;
/** A procedure in the manual's standard format. */
exports.task = (t) => `<section class="task"><header><span>Task</span><h4>${md(t.title)}</h4></header>
<dl>${t.purpose ? `<dt>Purpose</dt><dd>${md(t.purpose)}</dd>` : ''}${t.before ? `<dt>Before you begin</dt><dd>${md(t.before)}</dd>` : ''}</dl>
<div class="lbl">Steps</div>${exports.steps(t.steps)}
${t.expected ? `<div class="expect"><b>Expected result</b> ${md(t.expected)}</div>` : ''}${t.trouble ? `<div class="trouble"><b>If it does not work</b> ${md(t.trouble)}</div>` : ''}${t.extra || ''}</section>`;
exports.table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${md(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
exports.chapter = (id, no, title, intro, body) => `<section class="chapter" id="${id}"><div class="chap-head"><span class="chap-no">${no}</span><h2>${md(title)}</h2></div>${intro ? `<p class="lead">${md(intro)}</p>` : ''}${body}</section>`;
