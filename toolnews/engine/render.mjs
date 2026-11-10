// Toolnews render server: bundles the ToolNews composition ONCE (public dir = the job's own folder, symlinked) and keeps one
// browser open, then renders stills or the full video on request.
//   node toolnews/engine/render.mjs <publicDir> [browserExecutable]
// stdin: one JSON job per line
//   {"cmd": "stills", "props": "<plan.json>", "frames": [n, …], "out": "<dir>", "scale": 0.5, "quality": 75}
//   {"cmd": "video", "props": "<plan.json>", "out": "<file.mp4>", "crf": 18, "concurrency": 2}
// stdout: one JSON line per job  {"ok": true, ...}  or  {"ok": false, "error": "…"}
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const publicDir = path.resolve(process.argv[2] || path.join(root, 'public'));
const browserExecutable = process.argv[3] || process.env.CLIPPERZ_BROWSER || null;
const say = (o) => process.stdout.write(JSON.stringify(o) + '\n');

let serveUrl = null;
let browser = null;
const cleanup = async () => {
  try { if (browser) await browser.close({silent: true}); } catch {}
  try { if (serveUrl) fs.rmSync(serveUrl, {recursive: true, force: true}); } catch {}
};

try {
  serveUrl = await bundle({entryPoint: path.join(root, 'toolnews/remotion/index.ts'), publicDir, symlinkPublicDir: true});
  browser = await openBrowser('chrome', {browserExecutable, chromiumOptions: {gl: 'swangle'}});
  say({ready: true});
} catch (e) {
  say({ok: false, error: 'setup: ' + String(e?.message || e).slice(0, 400)});
  await cleanup();
  process.exit(1);
}

const rl = readline.createInterface({input: process.stdin});
for await (const line of rl) {
  if (!line.trim()) continue;
  const t0 = Date.now();
  try {
    const job = JSON.parse(line);
    const inputProps = JSON.parse(fs.readFileSync(job.props, 'utf8'));
    const composition = await selectComposition({serveUrl, id: 'ToolNews', inputProps, puppeteerInstance: browser});
    if (job.cmd === 'video') {
      let last = -1;
      await renderMedia({
        composition, serveUrl, inputProps, codec: 'h264', outputLocation: job.out, crf: job.crf ?? 18, imageFormat: 'png', colorSpace: 'bt709',
        audioCodec: 'aac', concurrency: job.concurrency || Math.max(1, os.cpus().length), puppeteerInstance: browser, overwrite: true,
        chromiumOptions: {gl: 'swangle'},
        onProgress: ({progress}) => {
          const p = Math.floor(progress * 10);
          if (p !== last) { last = p; process.stderr.write(`render ${p * 10}%\n`); }
        },
      });
      say({ok: true, file: job.out, sec: (Date.now() - t0) / 1000});
    } else {
      fs.mkdirSync(job.out, {recursive: true});
      const files = [];
      for (const frame of job.frames) {
        const f = Math.max(0, Math.min(composition.durationInFrames - 1, Math.round(frame)));
        const output = path.join(job.out, `f${String(f).padStart(5, '0')}.jpg`);
        await renderStill({composition, serveUrl, output, inputProps, frame: f, scale: job.scale ?? 0.5, imageFormat: 'jpeg',
          jpegQuality: job.quality ?? 75, puppeteerInstance: browser, overwrite: true});
        files.push(output);
      }
      say({ok: true, files, sec: (Date.now() - t0) / 1000});
    }
  } catch (e) {
    say({ok: false, error: String(e?.message || e).slice(0, 600)});
  }
}
await cleanup();
