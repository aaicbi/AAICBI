// Growth funnel: the Share kit. Default captions you can edit, add to, delete and reset; links tagged with a source label; the clickable PDF
// (its link annotations are read back out of the file); your own video and PDF recorded, shown and removed (the browser's direct upload to
// storage needs real storage credentials, so the file is recorded the way the browser records it after uploading); the made-for-you card files;
// who may use any of it; the audit log; and the screens.
const fs = require('fs');
const { execFileSync } = require('child_process');
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, h: r.headers }; };
(async () => {
  clearThrottle();
  const own = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  for (const t of ['GrowthScholarship', 'GrowthSquad', 'GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  psql(`update "Course" set published=true, status='PUBLISHED' where id='${own}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  const T = await jar('/api/auth/trainee-login', 't5@dev.test');
  const SH = (m, p, b) => call(S, m, '/api/admin/growth/share' + p, b);

  // ---- nothing live yet
  let r = await SH('GET', '');
  log(r.s === 200 && r.j.courses.length === 0 && r.j.isDefault === true && r.j.captions.length === r.j.defaultCount, 'before any link is live: no courses, and the default captions are in use');
  log((await call(null, 'GET', '/api/admin/growth/share')).s === 401 && (await call(T, 'GET', '/api/admin/growth/share')).s === 403, 'only a Super Admin can open the kit');
  log((await call(T, 'POST', '/api/admin/growth/share', { action: 'resetCaptions' })).s === 403, 'or change it');

  // ---- make the course's link live
  await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'propose' });
  for (const q of (await call(S, 'GET', `/api/admin/courses/${own}/growth`)).j.taster.questions) await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: q.questionId });
  await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  const slug = psql(`select slug from "GrowthCampaign" where "courseId"='${own}'`);
  r = await SH('GET', '');
  log(r.j.courses.length === 1 && r.j.courses[0].id === own && r.j.courses[0].link.endsWith(`/play/${slug}`), 'once the link is live the course appears with its funnel link');
  const defaults = r.j.captions;
  log(defaults.length === 5 && defaults.every((c) => c.text.includes('{link}')), 'five default captions, each with the link placeholder');

  // ---- captions: edit, add, delete, reset
  r = await SH('POST', '', { action: 'saveCaption', id: defaults[0].id, label: 'Beat the clock (mine)', text: 'Bet you cannot finish in 90 seconds. {link}' });
  log(r.s === 200 && r.j.isDefault === false && r.j.captions.length === 5 && r.j.captions[0].text.startsWith('Bet you cannot') && r.j.captions[0].id === defaults[0].id && r.j.captions[1].text === defaults[1].text, 'editing a default keeps the others and marks the list customised');
  r = await SH('POST', '', { action: 'saveCaption', label: 'Mine', text: 'No link in here at all, so it must be refused' });
  log(r.s === 400 && /\{link\}/.test(r.j.error), 'a caption without the link placeholder is refused, and says where it goes');
  log((await SH('POST', '', { action: 'saveCaption', label: '', text: 'Play now {link}' })).s === 400 && (await SH('POST', '', { action: 'saveCaption', label: 'x', text: '{link}' })).s === 400, 'a caption needs a name and some text');
  r = await SH('POST', '', { action: 'saveCaption', label: 'Church group', text: 'Dear church family, a free 90-second AI quiz for you: {link}' });
  log(r.s === 200 && r.j.captions.length === 6 && r.j.captions[5].label === 'Church group' && /^c-/.test(r.j.captions[5].id), 'a caption of your own is added');
  const mine = r.j.captions[5].id;
  r = await SH('POST', '', { action: 'deleteCaption', id: mine });
  log(r.s === 200 && r.j.captions.length === 5 && !r.j.captions.some((c) => c.id === mine), 'and can be deleted');
  log((await SH('POST', '', { action: 'deleteCaption', id: 'nope' })).s === 404, 'deleting one that is not there is a 404');
  for (let i = 0; i < 12; i++) await SH('POST', '', { action: 'saveCaption', label: 'Extra ' + i, text: 'Extra caption number ' + i + ' {link}' });
  log((await SH('GET', '')).j.captions.length === 12, 'up to twelve captions are kept');
  const cur = (await SH('GET', '')).j.captions;
  for (const c of cur.slice(1)) await SH('POST', '', { action: 'deleteCaption', id: c.id });
  r = await SH('POST', '', { action: 'deleteCaption', id: cur[0].id });
  log(r.s === 409 && /at least one/i.test(r.j.error), 'the last caption cannot be deleted');
  r = await SH('POST', '', { action: 'resetCaptions' });
  log(r.s === 200 && r.j.isDefault === true && r.j.captions.length === 5 && r.j.captions[0].text === defaults[0].text, 'back to the defaults restores all five, as they were');

  // ---- your own files
  const blob = (k, ext) => `https://store123.public.blob.vercel-storage.com/growth-share/${k}/my-file-AbC123.${ext}`;
  log((await SH('POST', '', { action: 'setAsset', courseId: own, kind: 'video', url: 'https://evil.example/x.mp4', name: 'x.mp4', size: 1000, contentType: 'video/mp4' })).s === 400, 'a file that was not stored by this app is refused');
  log((await SH('POST', '', { action: 'setAsset', courseId: own, kind: 'video', url: blob('video', 'pdf'), name: 'x.pdf', size: 1000, contentType: 'application/pdf' })).s === 400, 'a PDF in the video slot is refused');
  log((await SH('POST', '', { action: 'setAsset', courseId: own, kind: 'pdf', url: blob('pdf', 'pdf'), name: 'big.pdf', size: 26 * 1024 * 1024, contentType: 'application/pdf' })).s === 400, 'a PDF over 25 MB is refused');
  log((await SH('POST', '', { action: 'setAsset', courseId: 'nope', kind: 'pdf', url: blob('pdf', 'pdf'), name: 'a.pdf', size: 1000, contentType: 'application/pdf' })).s === 404, 'a course with no campaign takes no files');
  r = await SH('POST', '', { action: 'setAsset', courseId: own, kind: 'video', url: blob('video', 'mp4'), name: 'Welcome clip.mp4', size: 7_340_032, contentType: 'video/mp4' });
  log(r.s === 200 && r.j.courses[0].assets.video.name === 'Welcome clip.mp4' && r.j.courses[0].assets.video.size === 7340032, 'your video is recorded for the course');
  r = await SH('POST', '', { action: 'setAsset', courseId: own, kind: 'pdf', url: blob('pdf', 'pdf'), name: 'Our flyer.pdf', size: 800_000, contentType: 'application/pdf' });
  log(r.s === 200 && r.j.courses[0].assets.pdf.name === 'Our flyer.pdf' && r.j.courses[0].assets.video, 'and your PDF beside it');
  r = await SH('POST', '', { action: 'setAsset', courseId: own, kind: 'video', url: blob('video', 'mp4').replace('AbC123', 'NEW999'), name: 'Second clip.mp4', size: 1_000_000, contentType: 'video/mp4' });
  log(r.j.courses[0].assets.video.name === 'Second clip.mp4' && r.j.courses[0].assets.pdf.name === 'Our flyer.pdf', 'a new video replaces the old one and leaves the PDF alone');
  const up = await call(null, 'POST', '/api/admin/growth/share/upload-token', { type: 'blob.generate-client-token', payload: { pathname: 'growth-share/video/a.mp4', clientPayload: null, multipart: false } });
  log(up.s === 401 || up.s === 403, 'the upload door is closed to anyone who is not a Super Admin (' + up.s + ')');
  const upT = await call(T, 'POST', '/api/admin/growth/share/upload-token', { type: 'blob.generate-client-token', payload: { pathname: 'growth-share/video/a.mp4', clientPayload: null, multipart: false } });
  log(upT.s === 401 || upT.s === 403, 'including a trainee (' + upT.s + ')');

  // ---- the clickable PDF
  const pdfRes = await fetch(B + `/api/admin/growth/share/${own}/pdf?src=Lagos%20Group`, { headers: { Cookie: S } });
  const buf = Buffer.from(await pdfRes.arrayBuffer());
  log(pdfRes.status === 200 && /application\/pdf/.test(pdfRes.headers.get('content-type')) && buf.slice(0, 5).toString() === '%PDF-', 'the PDF is generated and is a real PDF (' + Math.round(buf.length / 1024) + ' KB)');
  fs.writeFileSync('/tmp/dev/share-test.pdf', buf);
  const info = JSON.parse(execFileSync('python3', ['-I', '-c', `
import json
from pypdf import PdfReader
r = PdfReader('/tmp/dev/share-test.pdf')
links = []
for p in r.pages:
    for a in (p.get('/Annots') or []):
        o = a.get_object()
        if o.get('/Subtype') == '/Link' and '/A' in o: links.append(str(o['/A'].get('/URI')))
box = r.pages[0].mediabox
print(json.dumps({'pages': len(r.pages), 'links': links, 'w': float(box.width), 'h': float(box.height), 'text': r.pages[0].extract_text()}))
`]).toString());
  const want = `/play/${slug}?src=lagos-group`;
  log(info.pages === 1 && info.links.length >= 2 && info.links.every((l) => l.endsWith(want)), 'one page, and its links go to the course funnel with the source label (' + info.links.length + ' links)');
  log(/Tap the card to play/.test(info.text) && info.w > info.h, 'with the caption "Tap the card to play", on a wide page shaped like the card');
  const defSrc = await fetch(B + `/api/admin/growth/share/${own}/pdf`, { headers: { Cookie: S } });
  log(defSrc.status === 200, 'without a label it still builds (labelled "pdf")');
  log((await fetch(B + `/api/admin/growth/share/nope/pdf`, { headers: { Cookie: S } })).status === 404 && (await fetch(B + `/api/admin/growth/share/${own}/pdf`, { headers: { Cookie: T } })).status === 403, 'a course with no campaign is a 404, and a trainee is refused');

  // ---- the made-for-you files
  const sizes = {};
  for (const f of ['play-card.mp4', 'play-card.gif', 'play-card.png', 'play-card-square.mp4', 'play-card-square.gif', 'play-card-square.png']) { const rr = await fetch(B + '/growth/' + f); sizes[f] = Buffer.from(await rr.arrayBuffer()).length; log(rr.status === 200 && sizes[f] > 1000, f + ' is served (' + Math.round(sizes[f] / 1024) + ' KB)'); }
  log(sizes['play-card.gif'] < 3 * 1024 * 1024 && sizes['play-card-square.gif'] < 3 * 1024 * 1024 && sizes['play-card.mp4'] < 2 * 1024 * 1024, 'the GIFs are under 3 MB and the video under 2 MB');
  const gif = Buffer.from(await (await fetch(B + '/growth/play-card.gif')).arrayBuffer());
  log(gif.slice(0, 6).toString() === 'GIF89a' && gif.includes(Buffer.from('NETSCAPE2.0')), 'the GIF is animated and loops');
  const mp4 = Buffer.from(await (await fetch(B + '/growth/play-card.mp4')).arrayBuffer());
  fs.writeFileSync('/tmp/dev/share-test.mp4', mp4);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', '/tmp/dev/share-test.mp4']).toString().trim());
  log(dur > 5.5 && dur < 6.5, 'the video is a 6-second loop (' + dur + 's)');

  // ---- the screens
  const br = await launch();
  const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const pg = await ctx.newPage();
  await pg.goto(`${B}/admin/growth`);
  await pg.getByTestId('growth-share').waitFor();
  await pg.getByTestId('share-link').waitFor();
  const shown = await pg.getByTestId('share-link').innerText();
  log(shown.endsWith(`/play/${slug}?src=whatsapp`), 'the link shows with the default source label (' + shown.replace(/^https?:\/\//, '') + ')');
  await pg.getByTestId('share-src').fill('Lagos Church Group');
  log((await pg.getByTestId('share-link').innerText()).endsWith(`?src=lagos-church-group`), 'typing a source label updates the link at once, cleaned');
  await pg.getByTestId('share-copy-link').click();
  log((await pg.evaluate(() => navigator.clipboard.readText())).endsWith(`/play/${slug}?src=lagos-church-group`), 'Copy link puts it on the clipboard');
  await pg.getByTestId('share-copy-html').click();
  const html = await pg.evaluate(() => navigator.clipboard.readText());
  log(/^<a href="[^"]+\?src=lagos-church-group"/.test(html) && /<img src="[^"]+\/growth\/play-card\.gif"/.test(html), 'Copy HTML gives a clickable animated card for a website or email');
  const firstText = await pg.getByTestId('caption-text').first().innerText();
  log(firstText.includes(`/play/${slug}?src=lagos-church-group`) && !firstText.includes('{link}'), 'each caption is shown with the real link already in it');
  await pg.getByTestId('caption-copy').first().click();
  log((await pg.evaluate(() => navigator.clipboard.readText())) === firstText, 'Copy on a caption copies exactly that text');

  // edit a caption on screen
  await pg.getByTestId('caption-edit').first().click();
  await pg.getByTestId('caption-textarea').fill('Edited on screen with no link at all');
  await pg.getByTestId('caption-save').click();
  await pg.getByTestId('share-problem').waitFor();
  log(/\{link\}/.test(await pg.getByTestId('share-problem').innerText()), 'saving without the link placeholder explains what is missing');
  await pg.getByTestId('caption-insert').click();
  log((await pg.getByTestId('caption-textarea').inputValue()).endsWith('{link}'), 'Insert {link} adds it');
  await pg.getByTestId('caption-label').fill('My edited one');
  await pg.getByTestId('caption-save').click();
  await pg.waitForTimeout(800);
  log((await pg.getByTestId('caption-text').first().innerText()).startsWith('Edited on screen with no link at all') && /Customised/.test(await pg.getByTestId('growth-share').innerText()), 'the edit is saved and the kit says Customised');
  // add one on screen
  await pg.getByTestId('caption-add').click();
  await pg.getByTestId('caption-label').last().fill('From the screen');
  await pg.getByTestId('caption-textarea').last().fill('Mothers union: play this free quiz and tell us your rank! {link}');
  await pg.getByTestId('caption-save').last().click();
  await pg.waitForTimeout(800);
  log((await pg.getByTestId('caption-row').count()) === 6, 'a new caption can be written on screen');
  // delete one
  pg.on('dialog', (d) => d.accept());
  await pg.getByTestId('caption-delete').last().click();
  await pg.waitForTimeout(800);
  log((await pg.getByTestId('caption-row').count()) === 5, 'and deleted');

  // files on screen
  const assetName = await pg.getByTestId('asset-video-name').innerText();
  log(/Second clip\.mp4/.test(assetName) && /Our flyer\.pdf/.test(await pg.getByTestId('asset-pdf-name').innerText()), 'your video and PDF are listed with their names and sizes');
  log((await pg.locator('[data-testid="asset-video"] video').count()) === 1, 'the video can be played right there');
  await pg.getByTestId('asset-pdf-copy').click();
  log((await pg.evaluate(() => navigator.clipboard.readText())).includes('.public.blob.vercel-storage.com/growth-share/pdf/'), 'Copy file link gives the hosted address of your PDF');
  log((await pg.getByTestId('asset-video-input').getAttribute('accept')).includes('video/mp4') && (await pg.getByTestId('asset-pdf-input').getAttribute('accept')) === 'application/pdf', 'the file pickers only offer the right kinds of file');
  await pg.getByTestId('asset-pdf-remove').click();
  await pg.waitForTimeout(800);
  log(!(await pg.getByTestId('asset-pdf').innerText()).includes('Our flyer.pdf') && (await SH('GET', '')).j.courses[0].assets.pdf === undefined && (await SH('GET', '')).j.courses[0].assets.video, 'removing the PDF leaves the video');
  // a too-big file is stopped in the browser, before any upload
  const big = '/tmp/dev/too-big.pdf'; fs.writeFileSync(big, Buffer.alloc(26 * 1024 * 1024));
  await pg.getByTestId('asset-pdf-input').setInputFiles(big);
  await pg.getByTestId('share-problem').waitFor();
  log(/too big|25 MB/i.test(await pg.getByTestId('share-problem').innerText()), 'a PDF over 25 MB is stopped on screen with a plain message');
  fs.rmSync(big, { force: true });
  log((await pg.getByTestId('share-gif').evaluate((el) => el.naturalWidth)) > 100 && (await pg.getByTestId('dl-pdf').getAttribute('href')).includes(`/share/${own}/pdf?src=lagos-church-group`), 'the card previews, and the PDF download carries the source label');
  await pg.getByTestId('growth-share').screenshot({ path: '/tmp/dev/growth11-desktop.png' });
  // reset on screen
  await pg.getByTestId('captions-reset').click();
  await pg.waitForTimeout(800);
  log(/Defaults/.test(await pg.getByTestId('growth-share').innerText()) && (await pg.getByTestId('caption-row').count()) === 5, 'Back to the defaults works on screen');
  const pm = await (await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' })).newPage();
  await pm.context().addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  await pm.goto(`${B}/admin/growth`);
  await pm.getByTestId('growth-share').waitFor();
  await pm.getByTestId('share-link').waitFor();
  log(await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the phone');
  await pm.getByTestId('growth-share').screenshot({ path: '/tmp/dev/growth11-phone.png' });
  await br.close();

  // ---- audit never holds a link or a url
  const audits = psql(`select string_agg(action, ',') from "GrowthAudit" where "scopeType"='SHARE'`);
  log(['SHARE_CAPTION_SAVED', 'SHARE_CAPTION_DELETED', 'SHARE_CAPTIONS_RESET', 'SHARE_FILE_SET', 'SHARE_FILE_REMOVED'].every((a) => audits.includes(a)), 'every change is in the recent changes log');
  psql(`delete from "GrowthSetting" where "scopeType" in ('SHARE','SHARE_ASSETS')`);
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
