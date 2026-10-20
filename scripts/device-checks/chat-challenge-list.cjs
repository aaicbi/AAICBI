// The "Challenge" list in the course chat: with many classmates every row stays one readable line, nothing overlaps, and the list scrolls.
const { B, log, launch, device, signedIn, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async () => {
  clearThrottle();
  psql(`update "Course" set published=true, status='PUBLISHED' where id='arena_play'`);
  psql(`update "ArenaConfig" set enabled=true,"chatEnabled"=true where "scopeType"='PLATFORM'`);
  const br = await launch();
  for (const [name, dev] of [['desktop', device('Desktop Chrome', { viewport: { width: 1360, height: 750 } })], ['phone', device('iPhone 13')]]) {
    const ctx = await signedIn(br, dev, '/api/auth/trainee-login', 't0@dev.test');
    // Many classmates, like a real cohort: add 45 people who are not online.
    await ctx.route('**/api/arena/courses/arena_play', async (rt) => {
      const res = await rt.fetch(); const j = await res.json();
      const names = ['Kufreh Johnson', 'Alabi Tunde', 'Ofonime Etim', 'Dominion Okon', 'Precious Nse', 'Granville Udo', 'Hope Joseph', 'Usoro James'];
      j.offline = Array.from({ length: 45 }, (_, i) => ({ id: 'fake' + i, name: names[i % names.length] + (i > 7 ? ' ' + i : ''), initials: names[i % names.length].split(' ').map((w) => w[0]).join('') }));
      await rt.fulfill({ response: res, json: j });
    });
    const pg = await ctx.newPage(); pg.setDefaultTimeout(20000);
    await pg.goto(`${B}/trainee/arena/arena_play/chat`, { waitUntil: 'load' });
    await pg.getByRole('button', { name: /Challenge/ }).first().click();
    await pg.locator('.ar-chatpick').waitFor();
    const m = await pg.evaluate(() => {
      const box = document.querySelector('.ar-chatpick'); const chat = document.querySelector('.ar-chat').getBoundingClientRect(); const bb = box.getBoundingClientRect(); const msgs = document.querySelector('.ar-chatlist').getBoundingClientRect(); const rows = [...box.querySelectorAll('.ar-pickrow')].map((r) => r.getBoundingClientRect());
      const cs = getComputedStyle(box);
      let overlap = 0; for (let i = 1; i < rows.length; i++) if (rows[i].top < rows[i - 1].bottom - 1 && Math.abs(rows[i].left - rows[i - 1].left) < 5) overlap++;
      const names = [...box.querySelectorAll('.ar-pickrow .ar-grow')].map((n) => n.getBoundingClientRect().height);
      return { n: rows.length, cols: cs.gridTemplateColumns.split(' ').length, overlap, minH: Math.min(...rows.map((r) => r.height)), maxName: Math.max(...names), scrolls: box.scrollHeight > box.clientHeight, boxH: box.clientHeight, left: bb.left - chat.left, fill: bb.height / chat.height, msgLeft: msgs.left, panelRight: bb.right, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    });
    log(m.n === 45 && m.cols === 1, name + ': one column with all ' + m.n + ' classmates (' + m.cols + ' column)');
    log(m.overlap === 0 && m.minH >= 28, name + ': no rows sit on top of each other (smallest row ' + Math.round(m.minH) + ' px)');
    log(m.maxName < 40, name + ': every name stays on one line');
    log(m.scrolls && m.fill > 0.6 && m.left < 20, name + ': the list runs down the left side of the chat, top to bottom, and scrolls (' + Math.round(m.fill * 100) + '% of the chat height)');
    if (name === 'desktop') log(m.panelRight <= m.msgLeft + 1, 'desktop: the messages sit beside the list, not under it');
    log(m.sw <= m.cw, name + ': no sideways scrolling');
    await pg.screenshot({ path: `/tmp/dev/chat-challenge-${name}.png` });
    await ctx.close();
  }
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
