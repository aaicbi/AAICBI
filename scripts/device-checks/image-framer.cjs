const { B, log, launch, device, signedIn } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
// A 1600x800 picture: top half red, bottom half blue.
const makePng = async (p) => Buffer.from(await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 800; const x = c.getContext('2d');
  x.fillStyle = '#ff0000'; x.fillRect(0, 0, 1600, 400); x.fillStyle = '#0000ff'; x.fillRect(0, 400, 1600, 400);
  const b = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer()));
}));
// The picture that was uploaded: its size and the colour of a few points.
const inspect = async (p, multipart) => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47]); const start = multipart.indexOf(sig); const end = multipart.indexOf(Buffer.from('IEND')) + 8;
  const png = multipart.subarray(start, end);
  return p.evaluate(async (arr) => {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(arr)], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
    const px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data).slice(0, 3);
    const q = Math.round(bmp.height / 4);
    return { w: bmp.width, h: bmp.height, upper: px(5, q), lower: px(5, bmp.height - q) };
  }, Array.from(png));
};
const isRed = (c) => c[0] > 200 && c[2] < 60, isBlue = (c) => c[2] > 200 && c[0] < 60;
(async () => {
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome'), '/api/auth/training-org-login', 'org@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(20000);
  let posted = null;
  await p.route('**/api/org/profile/cover', async (route) => { posted = route.request().postDataBuffer(); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://example.com/framed.png' }) }); });
  await p.goto(B + '/admin/organization/profile', { waitUntil: 'load' });
  await p.getByText('Cover picture').waitFor();
  const png = await makePng(p);
  const choose = () => p.setInputFiles('#org-cover-file', { name: 'wide.png', mimeType: 'image/png', buffer: png });
  const frame = p.getByTestId('image-frame');
  const shown = () => p.locator('[data-testid=image-frame] img').waitFor();

  // 1. opens a placing step with the picture in a wide frame
  await choose(); await frame.waitFor(); await shown();
  const fb = await frame.boundingBox();
  log(Math.abs(fb.width / fb.height - 5) < 0.1, `the frame has the shape of the cover on the page (${Math.round(fb.width)} x ${Math.round(fb.height)}, 5 to 1)`);
  log((await p.getByRole('button', { name: 'Use this picture' }).count()) === 1, 'there is a "Use this picture" button, and nothing is uploaded until it is pressed');
  log(posted === null, 'nothing was uploaded yet');
  const dlg = p.getByRole('dialog');
  log(await dlg.getByText('Northwind Academy').count() > 0, 'the editor shows the organization name under the picture, like the page');
  const ph = p.getByTestId('also-On a phone'); const pb = await ph.locator('div').first().boundingBox();
  log(pb && Math.abs(pb.width / pb.height - 3) < 0.1, `it also shows how the cover looks on a phone (${Math.round(pb.width)} x ${Math.round(pb.height)}, 3 to 1)`);
  const pageBanner = await p.evaluate(() => { const d = document.querySelector('[role=dialog]'); const f = d.querySelector('[data-testid=image-frame]'); return f.parentElement.parentElement.className.includes('rounded-xl'); });
  log(pageBanner, 'the frame sits in the same kind of card as the page preview');

  // 2. dragging the picture up shows its lower part: all blue
  const cx = fb.x + fb.width / 2, cy = fb.y + fb.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx, cy - 300, { steps: 8 }); await p.mouse.up();
  await p.getByRole('button', { name: 'Use this picture' }).click();
  await p.waitForTimeout(800);
  let r = posted && await inspect(p, posted);
  log(r && r.w === 1600 && r.h === 320, `it is saved in the cover's shape (${r && r.w} x ${r && r.h})`);
  log(r && isBlue(r.upper) && isBlue(r.lower), 'dragging it up kept the lower part (the saved picture is blue at both quarter points)');

  // 3. dragging down keeps the upper, red part
  posted = null; await choose(); await frame.waitFor(); await shown();
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx, cy + 300, { steps: 8 }); await p.mouse.up();
  await p.getByRole('button', { name: 'Use this picture' }).click(); await p.waitForTimeout(800);
  r = posted && await inspect(p, posted);
  log(r && isRed(r.upper) && isRed(r.lower), 'dragging it down kept the upper part (red at both quarter points)');

  // 4. untouched: centred, so red on top and blue below
  posted = null; await choose(); await frame.waitFor();
  await p.getByRole('button', { name: 'Use this picture' }).click(); await p.waitForTimeout(800);
  r = posted && await inspect(p, posted);
  log(r && isRed(r.upper) && isBlue(r.lower), 'left alone, it is centred (red above, blue below)');

  // 5. zoom in: a closer, smaller part
  posted = null; await choose(); await frame.waitFor();
  await p.getByLabel('Zoom', { exact: true }).fill('2');
  await p.getByRole('button', { name: 'Use this picture' }).click(); await p.waitForTimeout(800);
  r = posted && await inspect(p, posted);
  log(r && r.w === 800 && r.h === 160, `zoomed in, it keeps a closer part (${r && r.w} x ${r && r.h})`);

  // 6. cancel uploads nothing
  posted = null; await choose(); await frame.waitFor();
  await p.getByRole('button', { name: 'Cancel' }).click(); await p.waitForTimeout(400);
  log(posted === null && (await frame.count()) === 0, 'Cancel closes it and uploads nothing');

  // 7. the placed picture then saves with the page
  await choose(); await frame.waitFor(); await p.getByRole('button', { name: 'Use this picture' }).click();
  await p.getByAltText('Your cover picture').waitFor();
  await p.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(1200);
  log(psql(`select count(*) from "OrganizationPublicProfile" where "coverUrl"='https://example.com/framed.png'`) === '1', 'the placed picture is saved on the organization page');
  psql(`update "OrganizationPublicProfile" set "coverUrl"=null where "coverUrl"='https://example.com/framed.png'`);

  // 7a. a tall picture zoomed out to fit: the empty sides hold a blurred copy of the picture
  const tall = Buffer.from(await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 1600; const x = c.getContext('2d');
    x.fillStyle = '#ff0000'; x.fillRect(0, 0, 400, 1600); x.fillStyle = '#0000ff'; x.fillRect(400, 0, 400, 1600);
    const b = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer()));
  }));
  posted = null;
  await p.setInputFiles('#org-cover-file', { name: 'tall.png', mimeType: 'image/png', buffer: tall }); await frame.waitFor(); await shown();
  await p.getByRole('button', { name: 'Fit the whole picture' }).click(); await p.waitForTimeout(300);
  const blurLayer = await p.evaluate(() => [...document.querySelectorAll('[data-testid=image-frame] div')].some((d) => /blur/.test(d.style.filter)));
  log(blurLayer, 'with the whole picture fitted, the editor shows a blurred copy behind it');
  await p.getByRole('button', { name: 'Use this picture' }).click(); await p.waitForTimeout(900);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47]); const st = posted.indexOf(sig); const png2 = posted.subarray(st, posted.indexOf(Buffer.from('IEND')) + 8);
  const t = await p.evaluate(async (arr) => {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(arr)], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
    const px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data);
    return { w: bmp.width, h: bmp.height, left: px(8, bmp.height / 2), right: px(bmp.width - 9, bmp.height / 2), corner: px(2, 2), mid: px(bmp.width / 2, bmp.height / 2) };
  }, Array.from(png2));
  log(t.w === 1600 && t.h === 320, `saved in the banner's shape (${t.w} x ${t.h})`);
  log(t.left[3] === 255 && t.right[3] === 255 && t.corner[3] === 255, 'the saved picture has no see-through space');
  log(t.left[0] > 150 && t.left[2] < 100, `the left side is a blurred red copy (${t.left.slice(0, 3)})`);
  log(t.right[2] > 150 && t.right[0] < 100, `the right side is a blurred blue copy (${t.right.slice(0, 3)})`);

  // 7b. an already saved picture can be adjusted
  const existing = 'https://example.com/existing.png';
  psql(`update "OrganizationPublicProfile" set "coverUrl"='${existing}'`);
  await p.route(existing, (route) => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: png }));
  posted = null; await p.reload({ waitUntil: 'load' }); await p.getByText('Cover picture').waitFor();
  await p.getByRole('button', { name: 'Adjust picture' }).click(); await frame.waitFor(); await shown();
  log(true, 'Adjust picture opens the saved picture in the editor');
  const fb2 = await frame.boundingBox(); const ax = fb2.x + fb2.width / 2, ay = fb2.y + fb2.height / 2;
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(ax, ay + 300, { steps: 8 }); await p.mouse.up();
  await p.getByRole('button', { name: 'Use this picture' }).click(); await p.waitForTimeout(800);
  r = posted && await inspect(p, posted);
  log(r && isRed(r.upper) && isRed(r.lower), 'the adjusted picture is saved with the new placement');
  psql(`update "OrganizationPublicProfile" set "coverUrl"=null where "coverUrl"='${existing}' or "coverUrl"='https://example.com/framed.png'`);

  // 8. a profile picture: a round frame, saved square
  const mctx = await signedIn(br, device('Desktop Chrome'), '/api/auth/trainee-login', 't0@dev.test');
  const m = await mctx.newPage(); m.setDefaultTimeout(20000);
  let posted2 = null;
  await m.route('**/api/trainee/avatar', async (route) => { if (route.request().method() === 'POST') { posted2 = route.request().postDataBuffer(); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avatarUrl: 'https://example.com/a.png' }) }); } else route.continue(); });
  await m.goto(B + '/trainee/settings', { waitUntil: 'load' });
  await m.locator('input[type=file][accept^="image"]').first().waitFor({ state: 'attached' });
  await m.locator('input[type=file][accept^="image"]').first().setInputFiles({ name: 'wide.png', mimeType: 'image/png', buffer: await makePng(m) });
  const f2 = m.getByTestId('image-frame'); await f2.waitFor();
  const b2 = await f2.boundingBox();
  log(Math.abs(b2.width - b2.height) < 3, `the profile picture frame is square and round (${Math.round(b2.width)} x ${Math.round(b2.height)})`);
  await m.getByRole('button', { name: 'Use this picture' }).click(); await m.waitForTimeout(800);
  const r2 = posted2 && await inspect(m, posted2);
  log(r2 && r2.w === r2.h, `it is saved square (${r2 && r2.w} x ${r2 && r2.h})`);
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
