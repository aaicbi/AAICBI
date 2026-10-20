// Super Admin "Pictures" screen: only a Super Admin can open it or use its API; it reports what is stored and how many are large.
const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const jar = async (email, path = '/api/auth/login') => (await cookiesFor(path, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path) => { const r = await fetch(B + path, { method, redirect: 'manual', headers: { Cookie: cookie || '' } }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j }; };
(async () => {
  clearThrottle();
  const S = await jar('super@dev.test'), ST = await jar('staff@dev.test'), ORG = await jar('org@dev.test', '/api/auth/training-org-login');
  log([401, 403].includes((await call(null, 'GET', '/api/admin/pictures')).s), 'a visitor cannot check the pictures');
  log([401, 403].includes((await call(ST, 'POST', '/api/admin/pictures')).s), 'staff who are not Super Admin cannot shrink pictures');
  log([401, 403].includes((await call(ORG, 'POST', '/api/admin/pictures')).s), 'an organization cannot shrink pictures');
  const r = await call(S, 'GET', '/api/admin/pictures');
  log(r.s === 200 && typeof r.j.total === 'number' && typeof r.j.large === 'number' && Array.isArray(r.j.byKind) && !('candidates' in r.j), 'the Super Admin gets the counts, without any file address (' + r.j.total + ' stored, ' + r.j.large + ' large)');
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome'), '/api/auth/login', 'super@dev.test');
  const pg = await ctx.newPage(); pg.setDefaultTimeout(30000);
  await pg.goto(`${B}/admin/pictures`);
  await pg.getByTestId('pictures-summary').waitFor();
  const t = await pg.getByTestId('pictures-summary').innerText();
  log(/pictures/.test(t), 'the screen shows the summary: ' + t);
  const octx = await signedIn(br, device('Desktop Chrome'), '/api/auth/training-org-login', 'org@dev.test');
  const op = await octx.newPage(); await op.goto(`${B}/admin/pictures`); await op.waitForTimeout(1000);
  log(!/\/admin\/pictures$/.test(op.url()) && (await op.getByTestId('pictures-admin').count()) === 0, 'an organization is turned away from the screen');
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
