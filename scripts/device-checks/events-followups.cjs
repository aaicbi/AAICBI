// Event Manager follow-ups over HTTP against the local test database: repeating events, attendance reports, event email, the hourly job and
// upload/integration status. Needs the app on :3113 started with CRON_SECRET=devcron-secret (see docs/events.md).
const { B, cookiesFor, clearThrottle } = require('./lib.cjs');
const { execSync } = require('child_process');
const PSQL = `/usr/lib/postgresql/16/bin/psql -h 127.0.0.1 -p 5544 -U dev -d aaicbi_dev -At`;
const sql = (q) => execSync(`${PSQL} -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } };
const who = { super: ['/api/auth/login', 'super@dev.test'], org: ['/api/auth/training-org-login', 'org@dev.test'], t11: ['/api/auth/trainee-login', 't11@dev.test'], t0: ['/api/auth/trainee-login', 't0@dev.test'] };
const jar = {};
async function cookie(k) { if (!k) return ''; if (!jar[k]) jar[k] = (await cookiesFor(...who[k])).map((c) => `${c.name}=${c.value}`).join('; '); return jar[k]; }
async function call(k, method, path, body) {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: await cookie(k), 'x-req-method': method }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch { /* not json */ }
  return { s: r.status, j, text };
}
const local = (d) => new Date(d.getTime() + 3600e3).toISOString().slice(0, 16); // Africa/Lagos is UTC+1 all year
const at = (hours, len = 2) => ({ startLocal: local(new Date(Date.now() + hours * 3600e3)), endLocal: local(new Date(Date.now() + (hours + len) * 3600e3)) });
const base = (o = {}) => ({ title: 'FUP event', summary: 'A check.', timeZone: 'Africa/Lagos', delivery: 'PHYSICAL', venueName: 'Hall', address: '1 Road', city: 'Lagos', audience: 'PRIVATE', registrationMode: 'OPEN', ...at(48), ...o });
const notes = (type, id) => Number(sql(`select count(*) from "UserNotification" where type='${type}' and "recipientId"='${id}'`));
const sweep = async () => (await fetch(B + '/api/cron/event-sweep', { headers: { authorization: 'Bearer devcron-secret' } })).json();

(async () => {
  clearThrottle();
  const t11 = sql(`select id from "Trainee" where email='t11@dev.test'`);
  sql(`delete from "Event" where title like 'FUP %'`); sql(`delete from "UserNotification" where type like 'EVENT_%'`); sql(`delete from "NotificationLog" where type like 'EVENT_%'`); sql(`delete from "EventNotice"`);
  sql(`update "EventSettings" set enabled=true, "orgEventsEnabled"=true, "promotionsEnabled"=true, "registrationEnabled"=true, "emailEnabled"=true`);
  const T = (s) => 'FUP ' + s;

  // ---- repeating events
  const rep = await call('org', 'POST', '/api/org/events', { action: 'schedule', recurrence: { freq: 'WEEKLY', count: 4 }, data: base({ title: T('Weekly class'), audience: 'INVITED', targets: [{ kind: 'TRAINEE', refId: t11 }], ...at(72) }) });
  ok(rep.s === 201 && rep.j.created === 4, 'a weekly repeat makes four events');
  const ser = sql(`select "seriesId" from "Event" where id='${rep.j.event.id}'`);
  ok(sql(`select count(*) || ':' || count(distinct "startsAt") from "Event" where "seriesId"='${ser}'`) === '4:4', 'they are four separate events at different times, in one series');
  const clock = sql(`select string_agg(distinct to_char("startsAt" at time zone 'Africa/Lagos','HH24:MI'), ',') from "Event" where "seriesId"='${ser}'`);
  ok(!clock.includes(','), 'each starts at the same clock time');
  ok(Number(sql(`select count(*) from "UserNotification" where type='EVENT_INVITED' and "recipientId"='${t11}' and title like '%Weekly class%'`)) === 1, 'the invited trainee is told once for the whole series, not four times');
  ok((await call('org', 'POST', '/api/org/events', { action: 'submit', recurrence: { freq: 'WEEKLY', count: 3 }, data: base({ title: T('Series promo'), audience: 'PUBLIC', ...at(120) }) })).s === 422, 'a repeating event cannot be submitted for promotion all at once');
  ok((await call('org', 'POST', '/api/org/events', { action: 'schedule', recurrence: { freq: 'WEEKLY', count: 99 }, data: base({ title: T('Too many'), ...at(120) }) })).s === 422, 'more than 52 repeats is refused');
  ok(Number(sql(`select count(*) from "Event" where title in ('FUP Too many','FUP Series promo')`)) === 0, 'and nothing is left half-made');
  const second = sql(`select id from "Event" where "seriesId"='${ser}' and "seriesIndex"=2`);
  const cs = await call('org', 'POST', `/api/org/events/${second}/cancel`, { reason: 'Term ended early', scope: 'series' });
  ok(cs.s === 200 && cs.j.event.alsoCancelled === 2, 'cancelling this and later events cancels the rest of the series');
  ok(sql(`select string_agg(status::text, ',' order by "seriesIndex") from "Event" where "seriesId"='${ser}'`) === 'SCHEDULED,CANCELLED,CANCELLED,CANCELLED', 'the earlier event is left alone');
  const md = await call('org', 'GET', `/api/org/events/${rep.j.event.id}`); ok(md.j.seriesTotal === 4 && md.j.seriesLater === 0, 'the event knows its place in the series');

  // ---- email
  const em = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Email invite'), audience: 'INVITED', targets: [{ kind: 'TRAINEE', refId: t11 }], ...at(80) }) });
  ok(em.s === 201 && Number(sql(`select count(*) from "NotificationLog" where channel='EMAIL' and type='EVENT_INVITED' and "recipientId"='${t11}' and "relatedId"='${em.j.event.id}'`)) === 1, 'an invitation is also emailed (the attempt is logged)');
  const pubEv = await call('super', 'POST', '/api/admin/events', { action: 'schedule', data: base({ title: T('Public thing'), audience: 'PUBLIC', ...at(90) }) });
  await call('super', 'POST', `/api/admin/events/${pubEv.j.event.id}/promotion`, { action: 'publish' });
  ok(notes('EVENT_PUBLISHED', t11) === 1 && Number(sql(`select count(*) from "NotificationLog" where channel='EMAIL' and type='EVENT_PUBLISHED'`)) === 0, 'the public announcement stays in the app and is never emailed');
  sql(`update "EventSettings" set "emailEnabled"=false`);
  const before = Number(sql(`select count(*) from "NotificationLog" where channel='EMAIL' and type like 'EVENT_%'`));
  await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('No email'), audience: 'INVITED', targets: [{ kind: 'TRAINEE', refId: t11 }], ...at(82) }) });
  ok(Number(sql(`select count(*) from "NotificationLog" where channel='EMAIL' and type like 'EVENT_%'`)) === before, 'switching event email off stops it');
  sql(`update "EventSettings" set "emailEnabled"=true`);

  // ---- attendance report import
  const live = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Attendance event'), delivery: 'ONLINE', meetingUrl: 'https://meet.google.com/abc-defg-hij', audience: 'ORG_MEMBERS', registrationMode: 'REGISTRATION', ...at(-0.2, 1) }) });
  const lid = live.j.event.id;
  await call('t11', 'POST', `/api/events/${lid}/register`, {}); await call('t0', 'POST', `/api/events/${lid}/register`, {});
  const csv = 'Topic,Start\nAttendance event,now\n\nName (original name),User Email,Total Duration (minutes)\nKemi Alade,t11@dev.test,45\nGuest Person,guest@example.org,30\nAmara Nwosu,t0@dev.test,2\n';
  ok((await call('org', 'GET', `/api/org/events/${lid}/registrations`)).j?.rows?.length === 2, 'two people registered for the live session');
  ok((await call('t11', 'POST', `/api/org/events/${lid}/registrations`, { op: 'import_preview', csv })).s >= 401, 'a trainee cannot import an attendance report');
  const pv = await call('org', 'POST', `/api/org/events/${lid}/registrations`, { op: 'import_preview', csv, minMinutes: 5 });
  ok(pv.s === 200 && pv.j.preview.matched.length === 1 && pv.j.preview.tooShort.length === 1 && pv.j.preview.unmatched.length === 1, 'the preview matches one person, sets a short stay aside and reports one unmatched');
  ok(Number(sql(`select count(*) from "EventRegistration" where "eventId"='${lid}' and attended`)) === 0, 'previewing saves nothing');
  const ap = await call('org', 'POST', `/api/org/events/${lid}/registrations`, { op: 'import_apply', csv, minMinutes: 5 });
  ok(ap.s === 200 && ap.j.marked === 1, 'applying marks the matched person present');
  ok(sql(`select attended::text || ':' || coalesce("attendanceSource",'') from "EventRegistration" where "eventId"='${lid}' and "profileId"=(select id from "Profile" where "traineeId"='${t11}')`) === 'true:REPORT', 'and labels it as coming from a report');
  ok((await call('org', 'POST', `/api/org/events/${lid}/registrations`, { op: 'import_preview', csv: 'hello' })).s === 422, 'a file without a name or email column is explained, not guessed at');
  const fut = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Future attendance'), audience: 'ORG_MEMBERS', registrationMode: 'REGISTRATION', ...at(48) }) });
  ok((await call('org', 'POST', `/api/org/events/${fut.j.event.id}/registrations`, { op: 'import_preview', csv })).s === 409, 'a report cannot be imported before the event starts');

  // ---- the hourly job
  ok((await call(null, 'GET', '/api/cron/event-sweep')).s === 401, 'the hourly job refuses to run without the secret');
  const later = await call('super', 'POST', '/api/admin/events', { action: 'schedule', data: base({ title: T('Publish later'), audience: 'PUBLIC', ...at(60) }) });
  const lp = await call('super', 'POST', `/api/admin/events/${later.j.event.id}/promotion`, { action: 'publish', publishAtLocal: local(new Date(Date.now() + 2 * 3600e3)) });
  ok(lp.s === 200 && lp.j.event.published === false && (await call(null, 'GET', `/api/events/${later.j.event.id}`)).s === 404, 'an event set to publish later stays hidden');
  sql(`update "Event" set "publishAt"=now()-interval '1 minute' where id='${later.j.event.id}'`);
  ok((await call(null, 'GET', `/api/events/${later.j.event.id}`)).s === 200, 'it is visible the moment its time passes');
  const r1 = await sweep(); ok(r1.published >= 1, 'the hourly job then publishes it and tells people');
  ok(sql(`select "promotionStatus"::text from "Event" where id='${later.j.event.id}'`) === 'PUBLISHED' && notes('EVENT_PUBLISHED', t11) === 2, 'it is marked published and the audience told once');
  const soon = await call('org', 'POST', '/api/org/events', { action: 'schedule', data: base({ title: T('Reminder event'), audience: 'ORG_MEMBERS', registrationMode: 'REGISTRATION', ...at(0.8, 1) }) });
  await call('t11', 'POST', `/api/events/${soon.j.event.id}/register`, {});
  const rem = notes('EVENT_REMINDER', t11);
  await sweep();
  ok(notes('EVENT_REMINDER', t11) === rem + 1, 'a registered person gets the one-hour reminder');
  await sweep();
  ok(notes('EVENT_REMINDER', t11) === rem + 1, 'and not a second time');
  ok(sql(`select ("lastSweepAt" > now() - interval '1 minute')::text from "EventSettings"`) === 'true', 'the job records that it ran');
  sql(`update "EventSettings" set "lastSweepAt"=now()-interval '5 hours'`);
  const st = await call('super', 'GET', '/api/admin/events?take=1'); ok(new Date(st.j.settings.lastSweepAt).getTime() < Date.now() - 4 * 3600e3, 'the manager can tell when the job has gone quiet');

  // ---- uploads and integrations status
  const up = await call('org', 'GET', '/api/events/upload-token'); ok(up.s === 200 && up.j.available === (!!process.env.BLOB_READ_WRITE_TOKEN), 'the form can tell whether file uploads are set up');
  ok((await call('t11', 'GET', '/api/events/upload-token')).s === 403 && (await call(null, 'GET', '/api/events/upload-token')).s === 401, 'only event managers can ask about uploads');
  ok((await call('t11', 'POST', '/api/events/upload-token', {})).s === 403, 'and only managers can start an upload');
  const is = JSON.stringify((await call('super', 'GET', '/api/admin/integrations-status')).j);
  ok(is.includes('file_storage') && is.includes('scheduled_jobs'), 'the integrations screen reports file storage and the cron secret');

  sql(`delete from "Event" where title like 'FUP %'`);
  sql(`update "EventSettings" set "lastSweepAt"=now()`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
