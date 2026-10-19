// Builds the animated play card: frames captured from card.html one by one, then encoded to MP4 and GIF, plus a still PNG.
// Run: node scripts/growth-card/build.cjs        (needs ffmpeg and Chromium; writes into public/growth/)
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'public/growth');
const LOOP_MS = 6000, FPS = 30, POSTER_MS = 1300;
const VARIANTS = [
  { name: 'play-card', cls: 'land', w: 1200, h: 630, gifW: 560, webm: true },
  { name: 'play-card-square', cls: 'sq', w: 1080, h: 1080, gifW: 440 },
];
function logoSvg() {
  const s = fs.readFileSync(path.join(ROOT, 'src/components/brand/wordmark.ts'), 'utf8');
  const g = (n) => s.match(new RegExp('export const ' + n + '\\s*=\\s*(.*?);\\n', 's'))[1].trim().replace(/^"|"$/g, '');
  return `<svg class="logo" viewBox="0 0 192.1 162.57" role="img" aria-label="AAICBI"><polygon points="${g('PYRAMID_BIG')}" fill="#f4fbf7"/><polygon points="${g('PYRAMID_SMALL')}" fill="#7fd6a0"/><circle cx="96.05" cy="114.42" r="8.35" fill="#f2b84b"/><path transform="translate(16.43 160.57)" d="${g('PYRAMID_PATH')}" fill="#f4fbf7"/></svg>`;
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const html = fs.readFileSync(path.join(__dirname, 'card.html'), 'utf8').replace('<!--LOGO-->', logoSvg());
  const tmpHtml = path.join(__dirname, '.card.build.html');
  fs.writeFileSync(tmpHtml, html);
  const br = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  for (const v of VARIANTS) {
    const pg = await br.newPage({ viewport: { width: v.w, height: v.h } });
    await pg.goto('file://' + tmpHtml);
    await pg.evaluate((cls) => { document.getElementById('card').classList.add(cls); }, v.cls);
    await pg.evaluate(() => document.fonts.ready);
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gcard-'));
    const frames = (LOOP_MS / 1000) * FPS;
    for (let i = 0; i < frames; i++) {
      await pg.evaluate((t) => window.setTime(t), (i / FPS) * 1000);
      await pg.screenshot({ path: path.join(tmp, `f${String(i).padStart(4, '0')}.png`) });
    }
    await pg.evaluate((t) => window.setTime(t), POSTER_MS);
    await pg.screenshot({ path: path.join(OUT, `${v.name}.png`) });
    const mp4 = path.join(OUT, `${v.name}.mp4`), gif = path.join(OUT, `${v.name}.gif`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', '-movflags', '+faststart', mp4]);
    // A WebM copy for browsers that cannot decode H.264 (the About page lists both sources).
    if (v.webm) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p', '-an', '-row-mt', '1', path.join(OUT, `${v.name}.webm`)]);
    const pal = path.join(tmp, 'pal.png');
    const vf = `fps=10,scale=${v.gifW}:-1:flags=lanczos`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `${vf},palettegen=stats_mode=diff:max_colors=96`, pal]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-i', pal, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, '-loop', '0', gif]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(v.name, 'mp4', Math.round(fs.statSync(mp4).size / 1024) + 'KB', 'gif', Math.round(fs.statSync(gif).size / 1024) + 'KB');
    await pg.close();
  }
  await br.close();
  fs.rmSync(tmpHtml, { force: true });
})().catch((e) => { console.error(e); process.exit(1); });
