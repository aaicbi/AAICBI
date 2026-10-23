// Writing a CBT by hand: create an exam, type questions into the form (checks before saving, one correct answer, no repeated options, up to six
// options, add another), see what was stored, publish it, and check the same form is on the module assessment and course examination pages and
// works on a phone. Private test database only.
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t }; };
const ok = (c, m) => log(!!c, m);

(async () => {
  clearThrottle();
  psql(`delete from "Exam" where title like 'Manual CBT check%'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  const created = await call(S, 'POST', '/api/exams', { title: 'Manual CBT check', durationMinutes: 20, passMarkPercent: 80, randomizeQuestions: true, randomizeOptions: true, showResultImmediately: true, showCorrectAnswers: true, allowReview: true });
  ok(created.s === 201 || created.s === 200, 'an examination is created');
  const examId = created.j.id;

  // ---- the server's own rules
  const q = (over = {}) => call(S, 'POST', `/api/exams/${examId}/questions`, { text: 'What is 2 + 2?', options: [{ text: '3', isCorrect: false }, { text: '4', isCorrect: true }], ...over });
  ok((await call(null, 'POST', `/api/exams/${examId}/questions`, { text: 'x?', options: [] })).s === 401, 'no sign-in: refused');
  ok((await q({ options: [{ text: '3', isCorrect: true }, { text: '4', isCorrect: true }] })).s === 400, 'two correct answers: refused');
  ok((await q({ options: [{ text: '3', isCorrect: false }, { text: '4', isCorrect: false }] })).s === 400, 'no correct answer: refused');
  ok((await q({ options: [{ text: 'Four', isCorrect: true }, { text: ' four ', isCorrect: false }] })).s === 400, 'two options that say the same thing: refused');
  ok((await q({ options: [{ text: '4', isCorrect: true }] })).s === 400, 'one option: refused');
  ok(psql(`select count(*) from "Question" where "examId"='${examId}'`) === '0', 'nothing was saved by the refused ones');

  // ---- the screen
  const br = await launch();
  const ctx = await br.newContext({ ...device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }) });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const pg = await ctx.newPage();
  await pg.goto(`${B}/admin/exams/${examId}/import`, { waitUntil: 'networkidle' });
  ok(await pg.locator('[data-testid="aq-text"]').isVisible(), 'with no questions yet, the form is open');
  await pg.locator('[data-testid="aq-text"]').fill('Which of these is a programming language?');
  await pg.locator('[data-testid="aq-option-0"]').fill('Python');
  await pg.locator('[data-testid="aq-option-1"]').fill('Excel');
  await pg.locator('[data-testid="aq-save"]').click();
  ok(/Give at least 2|Mark the correct/.test(await pg.locator('[data-testid="aq-msg"]').innerText()), 'saving without a correct answer says what is missing');
  await pg.locator('[data-testid="aq-correct-0"]').check();
  await pg.locator('[data-testid="aq-option-1"]').fill('python');
  await pg.locator('[data-testid="aq-save"]').click();
  ok(/same thing/.test(await pg.locator('[data-testid="aq-msg"]').innerText()), 'two options that match are caught before saving');
  await pg.locator('[data-testid="aq-option-1"]').fill('Excel');
  await pg.locator('[data-testid="aq-add-option"]').click();
  await pg.locator('[data-testid="aq-add-option"]').click();
  ok(await pg.locator('[data-testid="aq-add-option"]').count() === 0, 'at most six options');
  await pg.locator('[data-testid="aq-option-4"]').fill('Word');
  await pg.getByRole('button', { name: 'Remove option E' }).click();
  await pg.getByLabel('Topic (optional)').fill('Basics');
  await pg.getByLabel('Difficulty').selectOption('INTERMEDIATE', { force: true }).catch(() => {});
  await pg.getByLabel('Explanation (optional)').fill('Python is a programming language.');
  await pg.locator('[data-testid="aq-save"]').click();
  await pg.waitForFunction(() => /Question saved/.test(document.querySelector('[data-testid="aq-msg"]')?.textContent ?? ''));
  ok(true, 'a question is saved from the form');
  ok(psql(`select count(*) from "Question" where "examId"='${examId}'`) === '1', 'one question stored');
  const stored = psql(`select string_agg(o.key||':'||o.text||':'||o."isCorrect", ' | ' order by o."order") from "Option" o join "Question" q on q.id=o."questionId" where q."examId"='${examId}'`);
  ok(stored.startsWith('A:Python:true | B:Excel:false'), `options are lettered, one correct: ${stored}`);
  ok(psql(`select topic||'|'||"needsReview"||'|'||coalesce(explanation,'') from "Question" where "examId"='${examId}'`) === 'Basics|false|Python is a programming language.', 'topic and explanation are stored, and it is ready to publish');
  ok(await pg.locator('[data-testid="aq-text"]').inputValue() === '' && await pg.locator('[data-testid="aq-option-0"]').inputValue() === '', 'the form clears for the next question');
  await pg.locator('[data-testid="aq-text"]').fill('What does CBT stand for?');
  await pg.locator('[data-testid="aq-option-0"]').fill('Computer-based test');
  await pg.locator('[data-testid="aq-option-1"]').fill('Central bank transfer');
  await pg.locator('[data-testid="aq-correct-0"]').check();
  await pg.locator('[data-testid="aq-save"]').click();
  await pg.waitForFunction(() => /Question saved/.test(document.querySelector('[data-testid="aq-msg"]')?.textContent ?? ''));
  ok(psql(`select count(*) from "Question" where "examId"='${examId}'`) === '2', 'a second question is added without leaving the page');
  await pg.reload({ waitUntil: 'networkidle' });
  ok((await pg.locator('body').innerText()).includes('Which of these is a programming language?') && (await pg.locator('body').innerText()).includes('Questions (2)'), 'both questions are listed on the page');
  await pg.screenshot({ path: '/tmp/dev/manual-cbt-desktop.png', fullPage: true });

  // ---- publishing and using it
  const pub = await call(S, 'POST', `/api/exams/${examId}/publish`);
  ok(pub.s === 200, `the examination publishes: ${pub.s} ${pub.t.slice(0, 80)}`);
  ok(psql(`select published::text from "Exam" where id='${examId}'`) === 'true', 'and is marked published');

  // ---- the same form on the other two kinds of exam
  const mod = psql(`select "moduleId" from "Exam" where "moduleId" is not null limit 1`);
  const crs = psql(`select "courseId" from "Exam" where "courseId" is not null limit 1`);
  if (mod) { await pg.goto(`${B}/admin/modules/${mod}/assessment`, { waitUntil: 'networkidle' }); ok(await pg.locator('[data-testid="add-question"]').count() === 1, 'the module assessment page has the form'); }
  if (crs) { await pg.goto(`${B}/admin/courses/${crs}/examination`, { waitUntil: 'networkidle' }); ok(await pg.locator('[data-testid="add-question"]').count() === 1, 'the course examination page has the form'); }

  // ---- phone
  const ph = await br.newContext({ ...device('iPhone 13') });
  await ph.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const pp = await ph.newPage();
  await pp.goto(`${B}/admin/exams/${examId}/import`, { waitUntil: 'networkidle' });
  await pp.locator('[data-testid="add-question-toggle"]').click();
  await pp.waitForSelector('[data-testid="aq-text"]');
  ok(!(await pp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'the form does not scroll sideways on a phone');
  await pp.locator('[data-testid="aq-text"]').scrollIntoViewIfNeeded();
  await pp.screenshot({ path: '/tmp/dev/manual-cbt-phone.png' });
  await br.close();

  psql(`delete from "Exam" where title like 'Manual CBT check%'`);
  const bad = results.filter((r) => !r[0]).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
