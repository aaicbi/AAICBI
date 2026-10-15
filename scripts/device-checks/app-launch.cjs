// The installed app's start address (/app) opens the feed for everyone; shortcuts still go to their own page.
const { B, log, results, cookiesFor, clearThrottle } = require('./lib.cjs');
const jar = (c) => c.map((x) => `${x.name}=${x.value}`).join('; ');
const where = async (path, cookie) => {
  const r = await fetch(B + path, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
  const loc = r.headers.get('location');
  return { status: r.status, loc: loc ? new URL(loc, B).pathname + new URL(loc, B).search : null };
};
(async () => {
  clearThrottle();
  const trainee = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  let r = await where('/app', trainee);
  log(r.loc === '/', `a signed-in trainee opening the app lands on the feed (${r.status} to ${r.loc})`);
  r = await where('/app', staff);
  log(r.loc === '/', `staff opening the app land on the feed (${r.loc})`);
  r = await where('/app', null);
  log(r.loc === '/', `a signed-out person opening the app lands on the feed (${r.loc})`);
  r = await where('/app?to=messages', trainee);
  log(r.loc === '/trainee/messages', `the Messages shortcut still opens messages (${r.loc})`);
  r = await where('/app?to=notifications', trainee);
  log(r.loc === '/notifications', `the Alerts shortcut still opens notifications (${r.loc})`);
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
