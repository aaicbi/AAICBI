// Staff permissions: the staff form (sections A to F), role templates, per-action permissions, anti-escalation, prompt revocation and suspension, and the audit trail.
const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (email, path = '/api/auth/login') => (await cookiesFor(path, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j }; };
(async () => {
  clearThrottle();
  psql(`delete from "User" where email like 'perm-check-%'`);
  psql(`update "User" set "staffRoleKey"=null, "permissionGrants"='{}', "permissionDenies"='{}', active=true where email='staff@dev.test'`);
  psql(`delete from "AuditEvent" where "resourceType" in ('staff','role')`);
  const S = await jar('super@dev.test'), ST = await jar('staff@dev.test');
  const staffId = psql(`select id from "User" where email='staff@dev.test'`), superId = psql(`select id from "User" where email='super@dev.test'`);

  // ---- an untouched account keeps its old access, and has no staff-management powers
  let r = await call(ST, 'GET', '/api/admin/staff');
  log([401, 403].includes(r.s), 'an untouched admin cannot open the staff list (it was always Super Admin only)');
  r = await call(S, 'GET', '/api/admin/staff');
  log(r.s === 200 && r.j.some((x) => x.email === 'staff@dev.test' && x.configured === false), 'the Super Admin sees staff, with accounts marked as standard or custom');

  // ---- granting one view permission, and revoking it, applies to the open session at once
  r = await call(S, 'PUT', `/api/admin/staff/${staffId}/access`, { staffRoleKey: 'custom', grants: ['staff.accounts:view'], denies: [] });
  log(r.s === 200 && r.j.effective.length === 1, 'the Super Admin gives one permission to start from nothing (' + r.j.effective?.length + ')');
  r = await call(ST, 'GET', '/api/admin/staff');
  log(r.s === 200, 'the permission works on the staff member\'s existing session');
  r = await call(ST, 'POST', '/api/admin/staff', { name: 'X', email: 'perm-check-x@dev.test', role: 'INSTRUCTOR' });
  log([401, 403].includes(r.s), 'but view does not let them create accounts: each action is its own permission');
  r = await call(S, 'PUT', `/api/admin/staff/${staffId}/access`, { staffRoleKey: 'custom', grants: [], denies: [] });
  r = await call(ST, 'GET', '/api/admin/staff');
  log([401, 403].includes(r.s), 'revoking it takes effect on the very next request');

  // ---- create with a template and a custom permission
  r = await call(S, 'POST', '/api/admin/staff', { name: 'Perm Check One', email: 'perm-check-1@dev.test', role: 'INSTRUCTOR', staffNumber: 'S-001', jobTitle: 'Moderator', staffRoleKey: 'gaming_ops_moderator', grants: ['billing.payments:view'], denies: ['gaming_ops.restrictions:manage'] });
  const id1 = r.j.id;
  log(r.s === 201 && !!id1, 'a staff account is created from a template with extra permissions and one removed');
  let d = (await call(S, 'GET', `/api/admin/staff/${id1}/access`)).j;
  log(d.effective.includes('gaming_ops.sessions:moderate') && d.effective.includes('billing.payments:view') && !d.effective.includes('gaming_ops.restrictions:manage'), 'its effective permissions are the template, plus the grant, minus the removal');
  log(!d.effective.some((k) => k.startsWith('gaming_studio.')), 'moderation never includes the Gaming Studio');
  log(d.staffNumber === 'S-001' && d.jobTitle === 'Moderator' && d.role === 'INSTRUCTOR', 'staff number, designation and account type are saved');
  r = await call(S, 'POST', '/api/admin/staff', { name: 'Perm Check Empty', email: 'perm-check-2@dev.test', role: 'ADMIN', staffRoleKey: 'custom' });
  const id2 = r.j.id;
  d = (await call(S, 'GET', `/api/admin/staff/${id2}/access`)).j;
  log(r.s === 201 && d.effective.length === 0, 'a new account created with nothing chosen gets nothing (not full admin rights)');
  r = await call(S, 'POST', '/api/admin/staff', { name: 'Bad', email: 'perm-check-3@dev.test', role: 'ADMIN', staffRoleKey: 'no_such_role' });
  log(r.s >= 400 && r.s < 500, 'an unknown role is refused (' + r.s + ')');
  r = await call(S, 'POST', '/api/admin/staff', { name: 'Sneaky', email: 'perm-check-4@dev.test', role: 'SUPER_ADMIN' });
  log(r.s === 400, 'a Super Admin can never be created from the app');

  // ---- the Gaming Studio door
  r = await call(S, 'PUT', `/api/admin/staff/${id1}/access`, { staffRoleKey: 'gaming_ops_moderator', grants: ['gaming_studio.games:publish'], denies: [] });
  d = (await call(S, 'GET', `/api/admin/staff/${id1}/access`)).j;
  log(!d.effective.includes('gaming_studio.games:publish'), 'a Studio action without Studio access is ignored');
  r = await call(S, 'PUT', `/api/admin/staff/${id1}/access`, { staffRoleKey: 'gaming_ops_moderator', grants: ['gaming_studio.access:view', 'gaming_studio.configs:view'], denies: [] });
  d = (await call(S, 'GET', `/api/admin/staff/${id1}/access`)).j;
  log(d.effective.includes('gaming_studio.configs:view') && !d.effective.includes('gaming_studio.games:publish') && !d.effective.includes('gaming_studio.games:delete'), 'view-only Studio access does not include publishing or deleting');

  // ---- delegation: a delegate cannot exceed their own authority
  await call(S, 'PUT', `/api/admin/staff/${staffId}/access`, { staffRoleKey: 'custom', grants: ['staff.permissions:assign_permissions', 'staff.permissions:view', 'billing.payments:view', 'reports.dashboards:view'], denies: [] });
  // (assign_permissions is high risk: a Super Admin may give it, a delegate may not pass it on)
  r = await call(ST, 'PUT', `/api/admin/staff/${id2}/access`, { staffRoleKey: 'custom', grants: ['billing.payments:view'], denies: [] });
  log(r.s === 200, 'a delegate can pass on a permission they hold');
  r = await call(ST, 'PUT', `/api/admin/staff/${id2}/access`, { staffRoleKey: 'custom', grants: ['billing.payments:view', 'security.logs:view'], denies: [] });
  log(r.s === 403, 'but not one they do not hold');
  r = await call(ST, 'PUT', `/api/admin/staff/${id2}/access`, { staffRoleKey: 'custom', grants: ['staff.permissions:assign_permissions'], denies: [] });
  log(r.s === 403, 'and never a high-risk one, even if they hold it');
  r = await call(ST, 'PUT', `/api/admin/staff/${staffId}/access`, { staffRoleKey: 'custom', grants: ['staff.permissions:assign_permissions', 'staff.permissions:view', 'billing.payments:view', 'reports.dashboards:view', 'billing.transactions:view'], denies: [] });
  log(r.s === 403, 'nobody can change their own permissions');
  r = await call(ST, 'PUT', `/api/admin/staff/${superId}/access`, { staffRoleKey: 'custom', grants: [], denies: [] });
  log(r.s === 403, 'nobody can change a Super Admin');
  r = await call(S, 'PUT', `/api/admin/staff/${superId}/access`, { staffRoleKey: 'custom', grants: [], denies: [] });
  log(r.s === 403, 'not even another Super Admin session can strip a Super Admin (no lock-out)');
  r = await call(ST, 'POST', '/api/admin/staff/roles', { name: 'Hacked', permissions: ['billing.payments:view'] });
  log([401, 403].includes(r.s), 'a delegate cannot create or edit roles without that permission');

  // ---- custom roles
  r = await call(S, 'POST', '/api/admin/staff/roles', { name: 'Weekend Moderator', description: 'Chat only', permissions: ['chat.rooms:view', 'chat.messages:moderate', 'nonsense'] });
  log(r.s === 201 && r.j.permissions.length === 2, 'a custom role is saved with only real permissions');
  const roleKey = r.j.key;
  r = await call(S, 'PUT', `/api/admin/staff/${id2}/access`, { staffRoleKey: roleKey, grants: [], denies: [] });
  d = (await call(S, 'GET', `/api/admin/staff/${id2}/access`)).j;
  log(d.effective.length === 2 && d.effective.includes('chat.messages:moderate'), 'a staff member can be given the custom role');
  await call(S, 'PUT', `/api/admin/staff/roles/${roleKey}`, { permissions: ['chat.rooms:view'] });
  d = (await call(S, 'GET', `/api/admin/staff/${id2}/access`)).j;
  log(d.effective.length === 1, 'editing the role changes everyone who has it at once');
  r = await call(S, 'DELETE', `/api/admin/staff/roles/${roleKey}`);
  log(r.s === 409, 'a role in use cannot be deleted');

  // ---- suspension ends an open session at once
  r = await call(S, 'PATCH', `/api/admin/staff/${staffId}`, { active: false });
  log(r.s === 200, 'a staff member can be suspended');
  r = await call(ST, 'GET', '/api/session/summary');
  log(r.j.signedIn === false, 'their open session ends on its next request');
  await call(S, 'PATCH', `/api/admin/staff/${staffId}`, { active: true });
  r = await call(ST, 'GET', '/api/session/summary');
  log(r.j.signedIn === true, 'and works again when reactivated');

  // ---- audit trail
  const ev = psql(`select string_agg(distinct action, ',') from "AuditEvent" where "resourceType" in ('staff','role')`);
  log(['PERMISSIONS_CHANGED', 'STAFF_CREATED', 'STAFF_SUSPENDED', 'STAFF_REACTIVATED', 'PERMISSIONS_REFUSED', 'ROLE_CREATED', 'ROLE_CHANGED', 'STUDIO_ACCESS_GRANTED'].every((a) => ev.includes(a)), 'every sensitive step is recorded: ' + ev);
  const denied = psql(`select count(*) from "AuditEvent" where action='ACCESS_DENIED'`);
  log(Number(denied) >= 2, 'denied attempts are recorded (' + denied + ')');
  const leaked = psql(`select count(*) from "AuditEvent" where coalesce(before::text,'')||coalesce(after::text,'')||coalesce(reason,'') ~* '(password|token|secret)'`);
  log(leaked === '0', 'the audit records hold no passwords or tokens');

  // ---- the staff form
  const br = await launch();
  for (const [label, dev] of [['desktop', device('Desktop Chrome', { viewport: { width: 1280, height: 900 } })], ['phone', device('iPhone 13')]]) {
    const ctx = await signedIn(br, dev, '/api/auth/login', 'super@dev.test');
    const pg = await ctx.newPage(); pg.setDefaultTimeout(20000);
    await pg.goto(`${B}/admin/staff/new`, { waitUntil: 'load' });
    await pg.getByTestId('staff-editor').waitFor();
    const text = await pg.getByTestId('staff-editor').innerText();
    log(/A\. Staff information/.test(text) && /B\. Role template/.test(text) && /C\. What they can access/.test(text) && /D\. Permission summary/.test(text) && /E\. Security warnings/.test(text) && /F\. Save and review/.test(text), label + ': the form has sections A to F');
    log((await pg.getByTestId('summary-total').innerText()).startsWith('0 of'), label + ': a new account starts with nothing selected');
    await pg.getByTestId('staff-template').selectOption('gaming_ops_moderator');
    const total = Number((await pg.getByTestId('summary-total').innerText()).match(/^(\d+) of/)[1]);
    log(total === 16, label + ': choosing a template fills the permissions in (' + total + ')');
    log(!(await pg.getByTestId('perm-gaming_studio.access:view').isChecked()), label + ': the template does not include the Gaming Studio');
    // search
    await pg.getByTestId('perm-search').fill('publish');
    log((await pg.getByTestId('cat-gaming_studio').count()) === 1 && (await pg.getByTestId('cat-billing').count()) === 0, label + ': search narrows the permissions');
    await pg.getByTestId('perm-search').fill('');
    // door
    await pg.getByTestId('expand-all').click();
    log(await pg.getByTestId('perm-gaming_studio.games:create').isDisabled(), label + ': Studio actions are locked until Studio access is switched on');
    await pg.getByTestId('perm-gaming_studio.access:view').check();
    log(!(await pg.getByTestId('perm-gaming_studio.games:create').isDisabled()), label + ': switching on access unlocks them');
    await pg.getByTestId('select-gaming_studio').click();
    log((await pg.getByTestId('perm-gaming_studio.games:create').isChecked()) && !(await pg.getByTestId('perm-gaming_studio.games:publish').isChecked()) && !(await pg.getByTestId('perm-gaming_studio.settings:configure').isChecked()), label + ': "select all (safe)" skips the high-risk actions');
    await pg.getByTestId('perm-gaming_studio.games:publish').check();
    const warn = await pg.getByTestId('warnings').innerText();
    log(/Publish/.test(warn) && /Gaming Studio/.test(warn) || /Access/.test(warn), label + ': high-risk choices are listed as warnings');
    await pg.getByTestId('clear-gaming_studio').click();
    log(!(await pg.getByTestId('perm-gaming_studio.games:create').isChecked()), label + ': clear removes a whole group');
    await pg.getByTestId('collapse-all').click();
    log((await pg.getByTestId('perm-gaming_ops.results:view').count()) === 0, label + ': collapse hides the detail');
    await pg.getByTestId('view-selected').click();
    log(/Game results/.test(await pg.getByTestId('selected-list').innerText()), label + ': "view selected" lists what is chosen');
    await pg.getByTestId('staff-compare').selectOption('reports_officer');
    log(/added/.test(await pg.getByTestId('compare-result').innerText()), label + ': compare shows the difference from another template');
    const fit = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log(fit <= 1, label + ': no sideways scrolling');
    if (label === 'desktop') {
      await pg.getByTestId('staff-name').fill('Perm Check UI');
      await pg.getByTestId('staff-email').fill('perm-check-ui@dev.test');
      await pg.getByTestId('staff-number').fill('S-UI');
      await pg.getByTestId('staff-title').fill('Support');
      await pg.getByTestId('staff-review').click();
      const rv = await pg.getByTestId('review-panel').innerText();
      log(/16 permissions will be granted/.test(rv) && /Perm Check UI/.test(rv), 'the review step shows what will be granted');
      await pg.screenshot({ path: '/tmp/dev/staff-editor-review.png' });
      await pg.getByTestId('staff-confirm').click();
      await pg.waitForURL(/\/admin\/staff$/);
      const row = psql(`select "staffRoleKey"||'|'||"staffNumber"||'|'||"jobTitle" from "User" where email='perm-check-ui@dev.test'`);
      log(row === 'gaming_ops_moderator|S-UI|Support', 'saving from the form creates the account (' + row + ')');
      const idUi = psql(`select id from "User" where email='perm-check-ui@dev.test'`);
      await pg.goto(`${B}/admin/staff/${idUi}`, { waitUntil: 'load' });
      await pg.getByTestId('staff-history').waitFor();
      log(/staff created/.test(await pg.getByTestId('staff-history').innerText()), 'the account page shows its history');
      await pg.screenshot({ path: '/tmp/dev/staff-editor-edit.png', fullPage: true });
    } else await pg.screenshot({ path: '/tmp/dev/staff-editor-phone.png' });
    await ctx.close();
  }
  // staff without the permission are sent away from the pages
  const sctx = await signedIn(br, device('Desktop Chrome'), '/api/auth/login', 'staff@dev.test');
  const sp = await sctx.newPage(); await sp.goto(`${B}/admin/staff/new`, { waitUntil: 'load' }); await sp.waitForTimeout(1200);
  log(!/\/admin\/staff/.test(sp.url()), 'a staff member without the permission is sent back to their dashboard');
  await br.close();

  psql(`update "User" set "staffRoleKey"=null, "permissionGrants"='{}', "permissionDenies"='{}', active=true where email='staff@dev.test'`);
  psql(`delete from "User" where email like 'perm-check-%'`);
  psql(`delete from "StaffRole" where key like 'role_weekend%'`);
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
