// The technology and architecture guide: thirteen chapters from five content files.
const parts = ['./tech-1.cjs', './tech-2.cjs', './tech-3.cjs', './tech-4.cjs', './tech-5.cjs'];
const prefixed = (list, prefix) => (prefix ? list.map((c) => ({ ...c, no: prefix + c.no, html: c.html.replace(/(<span class="chap-no">)(\d+)(<\/span>)/, `$1${prefix}$2$3`) })) : list);
exports.chapters = (L, prefix) => prefixed(parts.flatMap((p) => { delete require.cache[require.resolve(p)]; return require(p)(L); }), prefix);
exports.glossary = [
  ['API route', 'A web address the app’s code answers with data instead of a page.'],
  ['Cron job', 'A task the host runs on a timetable, such as every morning.'],
  ['Core file', 'A file of pure rules with no database or network, so it can be tested alone.'],
  ['Embedding', 'A list of numbers that stands for the meaning of a text, so two texts can be compared by meaning.'],
  ['Idempotent', 'Safe to do twice: the second time changes nothing.'],
  ['Migration', 'A reviewed step that changes the database structure.'],
  ['PWA', 'Progressive Web App: a website that can be installed on a phone and cope with a poor connection.'],
  ['RBAC', 'Role-based access control: what each person may do, decided by the server.'],
  ['SSE', 'Server-Sent Events: a one-way stream from the server to the browser.'],
  ['SSRF', 'Server-side request forgery: tricking a server into fetching an internal address.'],
  ['Webhook', 'A message another service sends to the app when something happens, such as a payment.'],
  ['zod', 'A library that checks data has the shape the code expects.'],
];
exports.support = (L) => L.p('This guide was prepared from the repository without a live system. Use the steps at the end of chapter 13 to check any statement. Counts and model names change as the platform grows; re-check them before quoting them.');
