const { B, log, launch, device, signedIn } = require('./lib.cjs');
const { execFileSync } = require('child_process');
const sql = (q) => execFileSync('psql', [...(process.env.PSQL_ARGS || '-h 127.0.0.1 -p 5544 -U dev -d aaicbi_dev').split(' '), '-At', '-c', q]).toString().trim();
(async () => {
  const cid = sql(`select id from "Course" where title='Python Foundations' limit 1`);
  const mid = sql(`select id from "Module" where "courseId"='${cid}' limit 1`);
  const br = await launch();
  for (const [label, d] of [['phone', device('iPhone 13')], ['tablet', device('iPad Mini')], ['tablet-landscape', device('iPad Mini landscape')]]) {
    const ctx = await signedIn(br, d, '/api/auth/training-org-login', 'org@dev.test');
    const p = await ctx.newPage(); p.setDefaultTimeout(20000);
    for (const [name, url] of [['builder', `/admin/courses/${cid}`], ['assessment', `/admin/modules/${mid}/assessment`], ['exam-new', '/admin/exams/new'], ['cert-studio', '/admin/certificate-templates']]) {
      await p.goto(B + url, { waitUntil: 'load' }); await p.waitForTimeout(2500);
      const note = await p.getByRole('note', { name: 'Larger screen recommended' }).isVisible().catch(() => false);
      const h = await p.evaluate(() => ({ hscroll: document.documentElement.scrollWidth > innerWidth + 1, w: innerWidth, title: document.querySelector('h1')?.textContent?.slice(0, 40) }));
      console.log(`${label.padEnd(16)} ${name.padEnd(12)} note=${note} ${JSON.stringify(h)}`);
      if (label === 'phone' && name === 'builder') await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/builder-phone.png' });
      if (label === 'tablet' && name === 'builder') await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/builder-tablet.png' });
      if (label === 'phone' && name === 'cert-studio') await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/cert-phone.png' });
    }
    await ctx.close();
  }
  await br.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 500)); process.exit(1); });
