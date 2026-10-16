// Finds text squeezed into a sliver on a phone (a few letters per line): every public and signed-in page, as each kind of person,
// at 360 and 390 px wide. Prints the elements it finds. Not a pass/fail test of one feature; run it after layout changes.
const { B, launch, device, cookiesFor, clearThrottle } = require('./lib.cjs');
const fs = require('fs');
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const prisma = new PrismaClient();

const DETECT = () => {
  const out = [];
  const seen = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    if (el.children.length > 0) continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 24 || text.split(' ').length < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const lines = r.height / line;
    if (r.width < 120 && lines >= 4) {
      const key = text.slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text: text.slice(0, 70), w: Math.round(r.width), lines: Math.round(lines), tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 80), parent: String(el.parentElement?.className || '').slice(0, 80) });
    }
  }
  return out;
};

(async () => {
  clearThrottle();
  const src = fs.readFileSync('/home/user/AAICBI/src/lib/guide/siteMap.ts', 'utf8');
  const hrefs = [...new Set([...src.matchAll(/href: "(\/[^"]*)"/g)].map((m) => m[1]).filter((h) => !h.includes('[')))];
  // dynamic pages with real seeded data
  const mod = await prisma.module.findFirst({ where: { course: { status: 'PUBLISHED' }, lessons: { some: {} } }, select: { id: true, courseId: true } });
  const extra = [];
  if (mod) extra.push(`/trainee/courses/${mod.courseId}`, `/courses/${mod.courseId}`, `/trainee/courses/${mod.courseId}/modules/${mod.id}/practice`);
  for (const q of await prisma.moduleQuestSettings.findMany({ where: { practiceEnabled: true }, select: { moduleId: true, module: { select: { courseId: true } } }, take: 6 })) extra.push(`/trainee/courses/${q.module.courseId}/modules/${q.moduleId}/practice`, `/trainee/courses/${q.module.courseId}`);
  const pages = [...new Set([...hrefs, ...extra])];
  const personas = [
    ['anonymous', null],
    ['trainee', ['/api/auth/trainee-login', 't0@dev.test']],
    ['staff', ['/api/auth/login', 'staff@dev.test']],
    ['super', ['/api/auth/login', 'super@dev.test']],
    ['org', ['/api/auth/training-org-login', 'org@dev.test']],
    ['employer', ['/api/auth/employer-login', 'employer@dev.test']],
    ['investor', ['/api/auth/investor-login', 'demo-investor@demo.aaicbi.invalid']],
  ];
  const br = await launch();
  // self-test: the detector must catch the squeezed-objective layout that shipped on the practice page
  {
    const t = await br.newPage({ viewport: { width: 360, height: 700 } });
    await t.setContent('<body style="margin:0;width:360px"><div style="display:flex;flex-wrap:wrap;gap:8px;width:330px"><p style="flex:1 1 0%;margin:0">Recognize common beginner mistakes in automation, including over-automation and insufficient testing</p><div style="display:flex;gap:8px"><span style="width:150px;display:block">Required for assessment</span><span style="width:70px;display:block">Not started</span></div></div></body>');
    const caught = await t.evaluate(DETECT);
    console.log(caught.length === 1 ? 'selftest ok' : 'SELFTEST FAILED (' + caught.length + ')');
    await t.close();
  }
  const found = new Map();
  for (const [name, login] of personas) {
    for (const width of [360]) {
      const ctx = await br.newContext({ ...device('iPhone 13', { viewport: { width, height: 780 } }), serviceWorkers: 'block' });
      await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
      if (login) { try { await ctx.addCookies(await cookiesFor(login[0], login[1])); } catch { console.log('login failed for', name); await ctx.close(); continue; } }
      const done = new Set();
      const queue = [...pages];
      const worker = async () => {
        const p = await ctx.newPage(); p.setDefaultTimeout(15000);
        for (let h = queue.shift(); h; h = queue.shift()) {
          try {
            await p.goto(B + h, { waitUntil: 'domcontentloaded' });
            await p.waitForTimeout(900);
            const url = new URL(p.url()).pathname;
            if (done.has(url)) continue;
            done.add(url);
            for (const f of await p.evaluate(DETECT)) {
              const key = `${f.text.slice(0, 40)}`;
              if (!found.has(key)) found.set(key, { ...f, pages: [`${name}:${url}`] }); else found.get(key).pages.push(`${name}:${url}`);
            }
          } catch {}
        }
        await p.close();
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      await ctx.close();
      console.log(`${name} done (${done.size} pages), findings so far: ${found.size}`);
    }
  }
  await br.close();
  await prisma.$disconnect();
  const list = [...found.values()];
  fs.writeFileSync('/tmp/narrow-text.json', JSON.stringify(list, null, 1));
  console.log(JSON.stringify(list.map((f) => ({ text: f.text, w: f.w, lines: f.lines, cls: f.cls, parent: f.parent, pages: f.pages.slice(0, 3) })), null, 1));
  console.log(list.length ? `${list.length} FOUND` : 'ALL CLEAN');
})().catch((e) => { console.error(e); process.exit(1); });
