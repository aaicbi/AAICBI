// Renders the PNG app icons from docs/brand/v3/svg (run after build_logo.py): node scripts/brand-icons.cjs
const { chromium } = require("playwright-core");
const fs = require("fs"), path = require("path");
const SVG = path.join(__dirname, "..", "docs", "brand", "v3", "svg"), OUT = path.join(__dirname, "..", "public", "icons");
const jobs = [["aaicbi-app-icon.svg", "icon-512.png", 512], ["aaicbi-app-icon.svg", "icon-192.png", 192], ["aaicbi-app-icon.svg", "icon-32.png", 32], ["aaicbi-app-icon-maskable.svg", "icon-maskable-512.png", 512], ["aaicbi-app-icon-maskable.svg", "apple-touch-icon.png", 180]];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await b.newPage();
  for (const [src, out, n] of jobs) {
    const svg = fs.readFileSync(path.join(SVG, src), "utf8").replace("<svg ", `<svg width="${n}" height="${n}" `);
    await p.setViewportSize({ width: n, height: n });
    await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
    await p.screenshot({ path: path.join(OUT, out), omitBackground: true });
  }
  await b.close();
})();
