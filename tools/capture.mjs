// Usage:
//   node tools/capture.mjs stills out_dir t1 t2 ...        -> PNG stills (native low-res)
//   node tools/capture.mjs video out.mp4 [scale] [audio]    -> full render, nearest-neighbour upscale, muxed audio
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const [mode, out, ...rest] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/${process.env.PAGE || 'index.html'}?capture`);
await page.waitForFunction(() => window.READY, null, { timeout: 60000 });
const grab = async (t) => {
  const q = process.env.JPEGQ ? +process.env.JPEGQ : 0;
  const url = await page.evaluate(({ t, q }) => { window.renderAt(t); const c = document.querySelector('canvas'); return q ? c.toDataURL('image/jpeg', q) : c.toDataURL('image/png'); }, { t, q });
  return Buffer.from(url.split(',')[1], 'base64');
};

if (mode === 'stills') {
  fs.mkdirSync(out, { recursive: true });
  const { fps } = await page.evaluate(() => window.SNIPPET);
  for (const t of rest.map(Number)) {   // warm up the feedback buffer with the preceding second
    if (!process.env.NOWARM) await page.evaluate(({ t, fps }) => { window.renderAt(0); for (let x = Math.max(0, t - 1); x < t - 1e-6; x += 1 / fps) window.renderAt(x); }, { t, fps });
    fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`), await grab(t));
  }
} else {
  const { total, fps } = await page.evaluate(() => window.SNIPPET);
  const scale = +(rest[0] || 4), audio = rest[1];
  const args = ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
  if (audio) args.push('-i', audio);
  args.push('-vf', `scale=iw*${scale}:ih*${scale}:flags=${process.env.SCALEFLAGS || 'neighbor'},format=yuv420p`, '-c:v', 'libx264', '-profile:v', 'high', '-crf', '17', '-maxrate', '28M', '-bufsize', '40M', '-preset', 'medium', '-r', String(fps), '-movflags', '+faststart');
  if (audio) args.push('-c:a', 'aac', '-b:a', '320k', '-ar', '48000');
  args.push(out);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] });
  const n = Math.round(total * fps);
  for (let i = 0; i < n; i++) {
    const buf = await grab(i / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${n}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close(); server.close();
