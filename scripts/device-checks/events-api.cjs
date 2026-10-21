// Event Manager, end to end over HTTP against the local test database: permissions, visibility, promotion workflow, joining details,
// registration and notifications. Needs the app on :3113 with the demo database (see docs/events.md).
const { B, cookiesFor, clearThrottle } = require('./lib.cjs');
const { execSync } = require('child_process');
const PSQL = `/usr/lib/postgresql/16/bin/psql -h 127.0.0.1 -p 5544 -U dev -d aaicbi_dev -At`;
const sql = (q) => execSync(`${PSQL} -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } };

const who = {
  super: ['/api/auth/login', 'super@dev.test'], staff: ['/api/auth/login', 'staff@dev.test'], org: ['/api/auth/training-org-login', 'org@dev.test'],
  t11: ['/api/auth/trainee-login', 't11@dev.test'], t0: ['/api/auth/trainee-login', 't0@dev.test'], employer: ['/api/auth/employer-login', 'employer@dev.test'],
};
const jar = {};
async function cookie(k) { if (!k) return ''; if (!jar[k]) jar[k] = (await cookiesFor(...who[k])).map((c) => `${c.name}=${c.value}`).join('; '); return jar[k]; }
async function call(k, method, path, body) {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: await cookie(k), 'x-req-method': method }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch { /* csv or html */ }
  return { s: r.status, j, text };
}
const local = (d) => new Date(d.getTime() + 3600e3).toISOString().slice(0, 16); // Africa/Lagos is UTC+1 all year
const at = (hours, len = 2) => ({ startLocal: local(new Date(Date.now() + hours * 3600e3)), endLocal: local(new Date(Date.now() + (hours + len) * 3600e3)) });
const base = (o = {}) => ({ title: 'Check event', summary: 'A check.', timeZone: 'Africa/Lagos', delivery: 'PHYSICAL', venueName: 'Hall', address: '1 Road', city: 'Lagos', audience: 'PRIVATE', registrationMode: 'OPEN', ...at(48), ...o });
const notes = (type, recipientId) => Number(sql(`select count(*) from "UserNotification" where type='${type}' and "recipientId"='${recipientId}'`));

(async () => {
  clearThrottle();
  const t11 = sql(`select id from "Trainee" where email='t11@dev.test'`), t0 = sql(`select id from "Trainee" where email='t0@dev.test'`);
  const northwind = sql(`select id from "TrainingOrganization" where email='org@dev.test'`);
  const otherOrg = sql(`select id from "TrainingOrganization" where email='demo-org2@demo.aaicbi.invalid'`);
  sql(`delete from "Event" where title like 'CHK %'`); sql(`delete from "UserNotification" where type like 'EVENT_%'`);
  sql(`update "EventSettings" set enabled=true, "orgEventsEnabled"=true, "promotionsEnabled"=true, "registrationEnabled"=true`);
  const T = (s) => 'CHK ' + s;

  // ---- who may open the manager
  ok((await call('staff', 'GET', '/api/admin/events')).s === 403, 'staff without event permissions cannot open the Event Manager');
  ok((await call('t11', 'GET', '/api/admin/events')).s === 403, 'a trainee cannot open the Event Manager');
  ok((await call(null, 'GET', '/api/admin/events')).s === 401, 'a visitor cannot open the Event Manager');
  const sa = await call('super', 'GET', '/api/admin/events'); ok(sa.s === 200 && sa.j.items, 'the Super Admin opens the Event Manager');
  const oo = await call('org', 'GET', '/api/org/events'); ok(oo.s === 200, 'an organisation owner opens its Event Manager');
  ok((await call('staff', 'POST', '/api/admin/events', { data: base({ title: T('x') }), action: 'save' })).s === 403, 'staff without the permission cannot create a platform event');

  // ---- platform public event: scheduling, publishing, visibility, joining details
  const pub = await call('super', 'POST', '/api/admin/events', { action: 'schedule', data: base({ title: T('Platform webinar'), delivery: 'HYBRID', audience: 'PUBLIC', meetingUrl: 'https://meet.google.com/abc-defg-hij', passcode: 'p4ss-code', joinInstructions: 'Use your real name.', summary: 'Open to all.', ...at(48) }) });
  ok(pub.s === 201 && pub.j.event.status === 'SCHEDULED' && pub.j.event.conferenceProvider === 'Google Meet', 'Super Admin schedules a hybrid public event; the provider is recognised');
  const pid = pub.j.event.id;
  ok(!JSON.stringify(pub.j).includes('meet.google.com') && !JSON.stringify(pub.j).includes('p4ss'), 'the saved event carries no meeting link or passcode');
  let lst = await call(null, 'GET', '/api/events?q=Platform%20webinar');
  ok(lst.s === 200 && lst.j.items.length === 0, 'an unpublished public event is invisible to visitors');
  ok((await call(null, 'GET', `/api/events/${pid}`)).s === 404, 'and its page answers "not found" to visitors');
  ok([403, 404].includes((await call('org', 'POST', `/api/org/events/${pid}/promotion`, { action: 'publish' })).s), 'an organisation cannot publish a platform event');
  ok([403, 404].includes((await call('staff', 'POST', `/api/admin/events/${pid}/promotion`, { action: 'publish' })).s), 'staff without the publish permission cannot publish');
  const pp = await call('super', 'POST', `/api/admin/events/${pid}/promotion`, { action: 'publish' });
  ok(pp.s === 200 && pp.j.event.published === true, 'Super Admin publishes it');
  lst = await call(null, 'GET', '/api/events?q=Platform%20webinar');
  ok(lst.j.items.length === 1, 'a published public event is listed for visitors');
  const dv = await call(null, 'GET', `/api/events/${pid}`);
  ok(dv.s === 200 && dv.j.event.hasJoinInfo === true && !JSON.stringify(dv.j).includes('meet.google.com'), 'visitors see that there is an online session but never the link');
  ok((await call(null, 'GET', `/api/events/${pid}/join`)).s === 401, 'visitors cannot fetch joining details');
  ok((await call('t11', 'GET', `/api/events/${pid}/join`)).s === 403, 'a trainee cannot fetch joining details before the window opens');
  ok(notes('EVENT_PUBLISHED', t11) === 1 && notes('EVENT_PUBLISHED', northwind) === 1, 'a trainee and an organisation are told once that the event was published');
  await call('super', 'POST', `/api/admin/events/${pid}/promotion`, { action: 'unpublish' }); await call('super', 'POST', `/api/admin/events/${pid}/promotion`, { action: 'publish' });
  ok(notes('EVENT_PUBLISHED', t11) === 1, 'publishing again does not tell anyone twice');

  // ---- a session starting soon: join window
  const soon = await call('super', 'POST', '/api/admin/events', { action: 'schedule', data: base({ title: T('Starting soon'), delivery: 'ONLINE', audience: 'PUBLIC', meetingUrl: 'https://us02web.zoom.us/j/123456789', passcode: 'zoom-pass', ...at(0.1, 1) }) });
  const sid = soon.j.event.id; await call('super', 'POST', `/api/admin/events/${sid}/promotion`, { action: 'publish' });
  const jn = await call('t11', 'GET', `/api/events/${sid}/join`);
  ok(jn.s === 200 && jn.j.meetingUrl.includes('zoom.us') && jn.j.passcode === 'zoom-pass' && jn.j.provider === 'Zoom', 'a signed-in trainee gets the link and passcode once the window is open');
  ok((await call(null, 'GET', `/api/events/${sid}/join`)).s === 401, 'a visitor still gets nothing');
  const dbPass = sql(`select "passcodeEnc" from "EventJoinInfo" where "eventId"='${sid}'`);
  ok(dbPass.startsWith('v1.') && !dbPass.includes('zoom-pass'), 'the passcode is stored encrypted');

  // ---- organisation: internal events, promotion workflow
  const priv = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Staff meeting'), audience: 'ORG_STAFF', delivery: 'ONLINE', meetingUrl: 'https://teams.microsoft.com/l/meetup-join/abc', ...at(72) }) });
  ok(priv.s === 201 && priv.j.event.conferenceProvider === 'Microsoft Teams', 'an organisation schedules an online staff meeting');
  const priv2 = (await call('t11', 'GET', '/api/events?q=Staff%20meeting')).j; ok(priv2.items.length === 0, 'a trainee cannot see the organisation’s staff meeting');
  ok((await call('t11', 'GET', `/api/events/${priv.j.event.id}`)).s === 404, 'and its page is "not found" for them');
  const drift = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Past'), startLocal: '2020-01-01T10:00', endLocal: '2020-01-01T11:00' }) });
  ok(drift.s === 422 && drift.j.fields.endLocal, 'a past date is refused when scheduling');
  const bad = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Bad link'), delivery: 'ONLINE', meetingUrl: 'http://zoom.us/j/1' }) });
  ok(bad.s === 422 && bad.j.fields.meetingUrl, 'an insecure meeting link is refused');
  const own = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Open day'), audience: 'PUBLIC', summary: 'Come and see.', ...at(96) }) });
  const oid = own.j.event.id;
  ok(own.s === 201 && own.j.event.published === false, 'a public-audience organisation event is not published by scheduling');
  ok((await call(null, 'GET', `/api/events/${oid}`)).s === 404, 'it is invisible to visitors');
  ok((await call('org', 'POST', `/api/org/events/${oid}/promotion`, { action: 'approve' })).s === 403 && (await call('org', 'POST', `/api/org/events/${oid}/promotion`, { action: 'publish' })).s === 403, 'the organisation cannot approve or publish its own event');
  const sub = await call('org', 'POST', `/api/org/events/${oid}/promotion`, { action: 'submit' });
  ok(sub.s === 200 && sub.j.event.managed.promotionStatus === 'SUBMITTED', 'the organisation submits it for public promotion');
  ok((await call(null, 'GET', `/api/events/${oid}`)).s === 404, 'still invisible while under review');
  const superId = sql(`select id from "User" where email='super@dev.test'`);
  ok(notes('EVENT_PROMOTION', superId) >= 1, 'the Super Admin is told a request arrived');
  ok((await call('super', 'POST', `/api/admin/events/${oid}/promotion`, { action: 'reject' })).s === 422, 'rejecting needs a reason');
  const ch = await call('super', 'POST', `/api/admin/events/${oid}/promotion`, { action: 'request_changes', reason: 'Add a venue map link.' });
  ok(ch.s === 200 && ch.j.event.managed.promotionStatus === 'CHANGES_REQUESTED' && ch.j.event.managed.promotionNote.includes('map'), 'corrections are requested with a reason');
  ok(notes('EVENT_PROMOTION', northwind) >= 1, 'the organisation is told');
  const rs = await call('org', 'POST', `/api/org/events/${oid}/promotion`, { action: 'submit' }); ok(rs.s === 200, 'the organisation resubmits');
  ok((await call('super', 'POST', `/api/admin/events/${oid}/promotion`, { action: 'publish' })).s === 409, 'publishing needs approval first');
  ok((await call('super', 'POST', `/api/admin/events/${oid}/promotion`, { action: 'approve' })).s === 200, 'approved');
  ok((await call(null, 'GET', `/api/events/${oid}`)).s === 404, 'approved is not yet public');
  const pb = await call('super', 'POST', `/api/admin/events/${oid}/promotion`, { action: 'publish' });
  ok(pb.s === 200 && pb.j.event.published && pb.j.event.organizer.name === 'Northwind Academy' && pb.j.event.organizer.promotedByAaicbi === false, 'published, still attributed to the organisation');
  ok((await call(null, 'GET', `/api/events/${oid}`)).s === 200, 'now public');
  const full = await call('org', 'GET', `/api/org/events/${oid}`);
  const ed = await call('org', 'PUT', `/api/org/events/${oid}`, { action: 'save', data: { ...full.j.event, startLocal: full.j.event.startLocal, endLocal: full.j.event.endLocal, title: T('Open day (renamed)') } });
  ok(ed.s === 200 && ed.j.event.managed.promotionStatus === 'SUBMITTED' && ed.j.event.published === false, 'changing promotional wording after approval sends it back for review');
  ok((await call(null, 'GET', `/api/events/${oid}`)).s === 404, 'and takes it off the public pages');

  // ---- isolation between organisations and from the platform
  const theirs = await call('super', 'POST', '/api/admin/events', { action: 'schedule', organizationId: otherOrg, data: base({ title: T('On behalf'), audience: 'PUBLIC', ...at(50) }) });
  ok(theirs.s === 201 && theirs.j.event.organizer.name === 'Demo Cloud Collective' && theirs.j.event.organizer.promotedByAaicbi === true, 'the Super Admin creates an event on behalf of an organisation, keeping the organiser’s identity');
  sql(`insert into "Event" (id,"trainingOrganizationId",title,"startsAt","endsAt","timeZone",delivery,status,audience,"registrationMode","promotionStatus","managedBy","updatedAt") values ('chk_foreign','${otherOrg}','CHK Foreign private',now()+interval '3 days',now()+interval '3 days 1 hour','Africa/Lagos','PHYSICAL','SCHEDULED','PRIVATE','OPEN','NONE','ORG',now())`);
  ok((await call('org', 'GET', '/api/org/events/chk_foreign')).s === 404, 'an organisation cannot read another organisation’s private event');
  ok((await call('org', 'PUT', '/api/org/events/chk_foreign', { action: 'save', data: base() })).s === 404, 'or change it');
  ok((await call('org', 'POST', '/api/org/events/chk_foreign/cancel', { reason: 'no' })).s === 404, 'or cancel it');
  ok((await call('org', 'GET', `/api/org/events/${pid}`)).s === 404, 'an organisation cannot open platform event management');
  ok((await call('org', 'PUT', `/api/org/events/${theirs.j.event.id}`, { action: 'save', data: base() })).s === 404, 'or another organisation’s promoted event');
  const orgList = (await call('org', 'GET', '/api/org/events?when=all')).j.items.map((e) => e.title);
  ok(orgList.every((t) => !t.includes('Foreign') && !t.includes('On behalf') && !t.includes('Platform webinar')), 'an organisation’s list contains only its own events');
  ok((await call('t11', 'GET', '/api/events/chk_foreign')).s === 404 && (await call(null, 'GET', '/api/events/chk_foreign')).s === 404, 'private events are invisible to trainees and visitors');
  ok((await call('super', 'GET', '/api/admin/events?when=all')).j.items.some((e) => e.id === 'chk_foreign'), 'the Super Admin sees every event on the global calendar');

  // ---- invited and selected audiences
  const inv = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Invited only'), audience: 'INVITED', registrationMode: 'INVITE_ONLY', targets: [{ kind: 'TRAINEE', refId: t11 }], ...at(60) }) });
  ok(inv.s === 201, 'an organisation invites one trainee'); const iid = inv.j.event.id;
  ok((await call('t11', 'GET', `/api/events/${iid}`)).s === 200 && (await call('t0', 'GET', `/api/events/${iid}`)).s === 404, 'only the invited trainee can see it');
  ok(notes('EVENT_INVITED', t11) >= 1 && notes('EVENT_INVITED', t0) === 0, 'only the invited trainee is notified');
  const foreignTarget = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Wrong course'), audience: 'SELECTED_TRAINEES', targets: [{ kind: 'COURSE', refId: 'does-not-exist' }] }) });
  ok(foreignTarget.s === 400, 'an organisation cannot aim an event at a course that is not its own');

  // ---- registration
  const reg = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Workshop'), audience: 'PUBLIC', registrationMode: 'REGISTRATION', capacity: 1, ...at(40) }) });
  const rid = reg.j.event.id; await call('org', 'POST', `/api/org/events/${rid}/promotion`, { action: 'submit' }); await call('super', 'POST', `/api/admin/events/${rid}/promotion`, { action: 'approve' }); await call('super', 'POST', `/api/admin/events/${rid}/promotion`, { action: 'publish' });
  ok((await call(null, 'POST', `/api/events/${rid}/register`, {})).s === 401, 'a visitor cannot register');
  const r1 = await call('t11', 'POST', `/api/events/${rid}/register`, {}); ok(r1.s === 200 && r1.j.status === 'CONFIRMED', 'a trainee registers');
  ok((await call('t11', 'POST', `/api/events/${rid}/register`, {})).s === 409, 'a second registration is refused');
  const r2 = await call('t0', 'POST', `/api/events/${rid}/register`, {}); ok(r2.s === 409 && /full/.test(r2.j.error), 'the event is full at capacity');
  ok(notes('EVENT_REGISTRATION', t11) >= 1, 'the trainee gets a confirmation');
  ok((await call('t11', 'GET', `/api/org/events/${rid}/registrations`)).s === 403 || (await call('t11', 'GET', `/api/org/events/${rid}/registrations`)).s === 401, 'a trainee cannot read the participant list');
  const lr = await call('org', 'GET', `/api/org/events/${rid}/registrations`); ok(lr.s === 200 && lr.j.rows.length === 1 && lr.j.rows[0].name === 'Kemi Alade', 'the organiser sees participants');
  const ex = await call('org', 'GET', `/api/org/events/${rid}/export`); ok(ex.s === 200 && ex.text.includes('Kemi Alade') && ex.text.includes('Account type'), 'the organiser exports the list');
  ok((await call('super', 'GET', `/api/admin/events/${rid}/export`)).s === 404 || (await call('super', 'GET', `/api/admin/events/${rid}/export`)).s === 403, 'platform staff cannot export an organisation’s participant list');
  ok((await call('org', 'POST', `/api/org/events/${rid}/registrations`, { op: 'attended', registrationId: lr.j.rows[0].id })).s === 409, 'attendance cannot be marked before the event starts');
  ok((await call('t11', 'DELETE', `/api/events/${rid}/register`)).s === 200, 'a trainee cancels their place');
  ok((await call('t0', 'POST', `/api/events/${rid}/register`, {})).s === 200, 'which frees it for someone else');
  const ap = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Approval event'), audience: 'ORG_MEMBERS', registrationMode: 'APPROVAL', ...at(30) }) });
  const aid = ap.j.event.id; sql(`insert into "EventRegistration" (id,"eventId","profileId",status,"updatedAt") select 'chk_reg','${aid}',id,'PENDING',now() from "Profile" where "traineeId"='${t11}'`);
  const dec = await call('org', 'POST', `/api/org/events/${aid}/registrations`, { op: 'confirm', registrationId: 'chk_reg' }); ok(dec.s === 200, 'the organiser confirms a pending registration');
  ok((await call('org', 'POST', `/api/org/events/${aid}/registrations`, { op: 'decline', registrationId: 'chk_reg' })).s === 422, 'declining needs a reason');

  // ---- cancel and reschedule notify the right people
  const cx = await call('org', 'POST', `/api/org/events/${rid}/cancel`, { reason: '' }); ok(cx.s === 422, 'cancelling needs a reason');
  const before = notes('EVENT_CANCELLED', t0);
  const cx2 = await call('org', 'POST', `/api/org/events/${rid}/cancel`, { reason: 'Venue unavailable' }); ok(cx2.s === 200 && cx2.j.event.status === 'CANCELLED', 'an organisation cancels its event');
  ok(notes('EVENT_CANCELLED', t0) === before + 1, 'a registered person is told once');
  ok((await call('org', 'PUT', `/api/org/events/${rid}`, { action: 'save', data: base() })).s === 409, 'a cancelled event cannot be edited');
  const rsd = await call('org', 'GET', `/api/org/events/${iid}`);
  const moved = await call('org', 'PUT', `/api/org/events/${iid}`, { action: 'save', data: { ...rsd.j.event, startLocal: at(80).startLocal, endLocal: at(80).endLocal, targets: rsd.j.event.managed.targets } });
  ok(moved.s === 200 && notes('EVENT_RESCHEDULED', t11) === 1, 'rescheduling tells the invited trainee');
  const again = await call('org', 'PUT', `/api/org/events/${iid}`, { action: 'save', data: { ...rsd.j.event, startLocal: at(80).startLocal, endLocal: at(80).endLocal, targets: rsd.j.event.managed.targets } });
  ok(again.s === 200, 'saving again');

  // ---- permissions by role and switches
  sql(`update "EventSettings" set "orgEventsEnabled"=false`);
  ok((await call('org', 'POST', '/api/org/events', { action: 'save', data: base({ title: T('Off') }) })).s === 403, 'organisation events can be switched off by the Super Admin');
  sql(`update "EventSettings" set "orgEventsEnabled"=true, enabled=false`);
  ok((await call('t11', 'GET', '/api/events')).j.items.length === 0 && (await call(null, 'GET', `/api/events/${pid}`)).s === 404, 'switching the Event Manager off hides everything from the public');
  sql(`update "EventSettings" set enabled=true`);

  sql(`delete from "Event" where title like 'CHK %' or id='chk_foreign'`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
