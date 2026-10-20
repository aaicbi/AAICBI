// A large picture chosen as an avatar or a cover is placed in the editor and saved small: WebP, at most 480 px for a profile photo and 1600 px for a banner.
const { B, log, launch, device, signedIn, clearThrottle } = require('./lib.cjs');
const fs = require('fs');
const FILE = '/tmp/dev/big-photo.png';
async function capture(pg, urlPart, action) {
  let body = null;
  await pg.route(`**${urlPart}`, async (rt) => { if (rt.request().method() === 'POST') { body = rt.request().postDataBuffer(); await rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avatarUrl: 'https://x.public.blob.vercel-storage.com/a.webp', logoUrl: 'https://x.public.blob.vercel-storage.com/a.webp' }) }); } else rt.continue(); });
  await action();
  await pg.waitForTimeout(1500);
  return body;
}
const dims = (buf) => { // reads a WebP VP8/VP8L/VP8X header
  const t = buf.toString('latin1', 8, 12); if (t !== 'WEBP') return null;
  const f = buf.toString('latin1', 12, 16);
  if (f === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (f === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
  if (f === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  return null;
};
(async () => {
  clearThrottle();
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome'), '/api/auth/trainee-login', 't0@dev.test');
  const pg = await ctx.newPage(); pg.setDefaultTimeout(15000);
  await pg.goto(`${B}/trainee/settings`, { waitUntil: 'load' });
  const original = fs.statSync(FILE).size;
  const body = await capture(pg, '/api/trainee/avatar', async () => {
    await pg.locator('input[type=file]').first().setInputFiles(FILE);
    await pg.getByRole('button', { name: 'Use this picture' }).click();
  });
  log(!!body, 'the placed profile picture is uploaded');
  if (body) {
    const txt = body.toString('latin1');
    const name = (txt.match(/filename="([^"]+)"/) || [])[1];
    const type = (txt.match(/Content-Type: ([^\r\n]+)/i) || [])[1];
    const start = body.indexOf(Buffer.from('RIFF'));
    const webp = body.subarray(start, body.lastIndexOf(Buffer.from('\r\n--')));
    const d = dims(webp);
    log(type === 'image/webp' && /\.webp$/.test(name), 'it is saved as WebP (' + type + ', ' + name + ')');
    log(d && d[0] <= 480 && d[1] <= 480, 'a profile picture is at most 480 px (' + (d && d.join('x')) + ')');
    log(webp.length < 60 * 1024 && webp.length < original / 20, 'and small: ' + Math.round(webp.length / 1024) + ' KB from ' + Math.round(original / 1024) + ' KB');
  }
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
