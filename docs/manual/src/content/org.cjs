// Part A: the training organisation manual.
const common = require('./common.cjs');
const parts = ['./org-a.cjs', './org-b.cjs', './org-c.cjs'];
const prefixed = (list, prefix) => (prefix ? list.map((c) => ({ ...c, no: prefix + c.no, html: c.html.replace(/(<span class="chap-no">)(\d+)(<\/span>)/, `$1${prefix}$2$3`) })) : list);
exports.chapters = (L, prefix) => prefixed(parts.flatMap((p) => { delete require.cache[require.resolve(p)]; return require(p)(L); }), prefix);
exports.glossary = common.glossary;
exports.support = (L) => common.supportBody(L, 'org');
